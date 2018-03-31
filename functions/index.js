'use strict';

process.env.DEBUG = 'actions-on-google:*';
const App = require('actions-on-google').DialogflowApp;
const functions = require('firebase-functions');
const firebase = require('firebase');

// Initialize Firebase
var config = {
  apiKey: "AIzaSyDN0_d-tJOJaIrlcIdr0YeqRkOCY698YWg",
  authDomain: "buck-i-spy.firebaseapp.com",
  databaseURL: "https://buck-i-spy.firebaseio.com",
  projectId: "buck-i-spy",
  storageBucket: "buck-i-spy.appspot.com",
  messagingSenderId: "382668481477"
};
firebase.initializeApp(config);


// a. the action name from the make_name Dialogflow intent
const GET_CHALLENGE_ACTION = 'get_challenge';
const GET_RANKING_ACTION = 'get_ranking';
const POST_LOCATION_ACTION = 'post_location';
const PERMISSION_LOCATION_ACTION = 'location_info';
// b. the parameters that are parsed from the make_name intent
const CHARACTER_ARGUMENT = 'Character';

//Global Variables
const ASK_MORE = " Is there anything else I can help you with?";


exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const app = new App({request, response});
  const userId = app.getUser().userId;
  console.log('Request headers: ' + JSON.stringify(request.headers));
  console.log('Request body: ' + JSON.stringify(request.body));

  // c. The function that generates the workout
  function makeChallenge (app) {
    let score = 0;
    return firebase.database().ref('users/' + userId).once('value').then((snapshot) => {
      let score = snapshot.child("score").val() === null ? 0 : snapshot.child("score").val();
      let currentLocation = snapshot.child("target").child("name").val() === null ? "" : snapshot.child("target").child("name").val();
      if (currentLocation !== "") {
        app.tell("<speak>Your current target location is " + currentLocation + ". Go there and say, Okay Google, tell Buck I Spy I'm here. Happy hunting!</speak>");
        return true;
      } else {
        return firebase.database().ref('locations/').once('value').then((snapshot) => {
          let locationIndex = Math.floor(Math.random()*snapshot.numChildren());
          let i = 0;
          snapshot.forEach((location) => {
            if (i === locationIndex) {
              firebase.database().ref('users/' + userId + '/target').update({
                latitude: location.child("latitude").val(),
                longitude: location.child("longitude").val(),
                name: location.key,
              });
              app.tell("<speak>Your new target location is " + location.key + ". Go there and say, Okay Google, tell Buck I Spy I'm here. Happy hunting!</speak>");
            }
            i++;
          });
          return true;
        });
      }
    });
  }

  function makeRanking (app) {
    let rankingRef = firebase.database().ref('users/').orderByChild('score');
    return rankingRef.once('value').then((snapshot) => {
      let rank = snapshot.numChildren();
      let userRank = 0;
      let userScore = 0;
      snapshot.forEach((user) => {
        let score = user.child("score").val();
        if (user.key === userId) {
          userRank = rank;
          userScore = score;
          console.log("user id:" + user.key);
        }
        rank--;
      });
      let playerCount = snapshot.numChildren();
      app.tell("<speak>Your rank is " + userRank + " of " + playerCount + " total players with a score of " + userScore + ".</speak>");
      return true;
    });
  }

  function postLocation (app) {
    return firebase.database().ref('users/' + userId + "/target").once('value').then((snapshot) => {
      // Ask for one permission
      app.askForPermission('To see if you found ' + snapshot.child("name").val(), app.SupportedPermissions.DEVICE_PRECISE_LOCATION);
      return true;
    });
  }

  function permissionLocation (app) {
    // Ask for one permission
    if (app.isPermissionGranted()) {
      const latitude = app.getDeviceLocation().coordinates.latitude;
      const longitude = app.getDeviceLocation().coordinates.longitude;
      return firebase.database().ref('users/' + userId).once('value').then((snapshot) => {
        let targetLatitude = snapshot.child("target").child("latitude").val();
        let targetLongitude = snapshot.child("target").child("longitude").val();
        let targetLocation = snapshot.child("target").child("name").val();
        let score = snapshot.child("score").val();
        var R = 6371e3; // metres
        var φ1 = targetLatitude * Math.PI / 180;
        var φ2 = latitude * Math.PI / 180;
        var Δφ = (latitude-targetLatitude) * Math.PI / 180;
        var Δλ = (longitude-targetLongitude) * Math.PI / 180;

        var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        var distance = R * c * 0.000621371;
        if (distance < 0.05) {
          firebase.database().ref('users/' + userId ).update({
            score: score + 10,
            target: {
              latitude: targetLatitude,
              longitude: targetLongitude,
              name: "",
            }
          });
          app.tell("<speak>You found " + targetLocation +"! Here's 10 points for showing up. Open the Buck I Spy mobile app to take a picture and earn even more points! </speak>");
        } else {
          app.tell("<speak>You are " + distance.toFixed(2) + " miles away from " + targetLocation + ". Get closer and try again.</speak>");
        }
        return true;
      });
    } else {
      app.tell("<speak>Location Post Endpoint. " + ASK_MORE + "</speak>");
      return true;
    }
  }

  // d. build an action map, which maps intent names to functions
  let actionMap = new Map();
  actionMap.set(GET_CHALLENGE_ACTION, makeChallenge);
  actionMap.set(GET_RANKING_ACTION, makeRanking);
  actionMap.set(POST_LOCATION_ACTION, postLocation);
  actionMap.set(PERMISSION_LOCATION_ACTION, permissionLocation);

app.handleRequest(actionMap);
});
