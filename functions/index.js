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
    let locationArray = ["the Ohio Union", "the RPAC", "the Shoe", "the ARC", "Thompson Library", "18th Avenue Library", "Dreese Labs", "Traditions at Scott"];
    let location = locationArray[Math.floor(Math.random()*locationArray.length)];
    let score = 0;
    return firebase.database().ref('users/' + userId).once('value').then((snapshot) => {
      let score = snapshot.child("score").val() === null ? 0 : snapshot.child("score").val();
      if (snapshot.child("target").val()) {
        app.tell("<speak>Your current target location is " + snapshot.child("target").val() + ". Go there and say, Okay Google, I'm here. Happy hunting!</speak>");
        return true;
      } else {
        firebase.database().ref('users/' + userId).update({
          target: location,
          score: score,
        });
        app.tell("<speak>Your new target location is " + location + ". Go there and say, Okay Google, I'm here. Happy hunting!</speak>");
        return true;
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
    // Ask for one permission
    app.askForPermission('To see if you found the OSU location', app.SupportedPermissions.DEVICE_PRECISE_LOCATION);
    return true;
  }

  function permissionLocation (app) {
    // Ask for one permission
    if (app.isPermissionGranted()) {
      const latitude = app.getDeviceLocation().coordinates.latitude;
      const longitude = app.getDeviceLocation().coordinates.longitude;
      return firebase.database().ref('users/' + userId + '/target/').once('value').then((snapshot) => {
        let targetLatitude = snapshot.child("latitude").val();
        let targetLongitude = snapshot.child("longitude").val();
        let distance = Math.sqrt(Math.pow(targetLatitude - latitude, 2) + Math.pow(targetLongitude - longitude, 2));
        app.tell("<speak>You are at latitude " + latitude + " and longitude " + longitude + ". Your target latitude is " + targetLatitude + " and your target longitude is " + targetLongitude + ". You are " + distance + " degrees away </speak>");
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
