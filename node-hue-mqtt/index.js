"use strict";

const mqtt = require('mqtt');
const hue = require("node-hue-api");
const chalk = require('chalk');
const topics = require('./topics')
const activeTopics = generateActiveTopics();

/**
 * Configure MQTT
 */
const client = mqtt.connect('mqtt://localhost');

/**
 * Configure Hue API
 */
const HueApi = hue.HueApi;
const lightState = hue.lightState;
const host = '192.168.178.26'; // Can vary
const name = 'NodeAPI';
var username = 'ifcHnVHvgOcHjfBQZZxMonBXb7a3cR9p8P8rizwQ'; // Must currently be set before starting the API. Future versions of the API should manage this through the /config channel 
var state = lightState.create();
const api = new HueApi(host, username);
const HUE_LOG = chalk.white.bgMagenta('[HUE]')

client.on('connect', function() {  
  console.log('\nClient connected! Subscribing to ' + formattedTopics() + ' ...');
  client.subscribe(activeTopics);
  
  // # Uncomment to display Hue device infos on initial connection
  // api.config().then(function(e) {
  //   console.log(JSON.stringify(e, null, 2));
  // }).done();

  // # Uncomment to publish a color-message to the lights/color topic
  // client.publish('lights/color', '{"deviceID": "1", "color": [255, 0, 255], "state": "on"}');

  // # Uncomment to publish a toggle-message to the lights/toggle topic
  // client.publish('lights/toggle', '{"on": true}');
});

client.on('message', function(topic, message) {
  console.log(chalk.gray('\nNew Message:'));
  console.log('-> ' + chalk.yellow(message.toString()) + '\n');
  handleMessage(topic, message);

  // Uncomment to end the client-session after receiving the first valid message
  // client.end();
});

function handleMessage(topic, message) {
  var topicPaths = topic.split('/')

  switch (topicPaths[0]) {
    // lights/#
    case 'lights': {
      if (topicPaths.length < 2 || !topics.lights.topics[topicPaths[1]]) {
        return console.log('Trying to handle /lights without valid sub-topic. ');
      }
      var subTopic = topicPaths[1];

      switch (subTopic) {
        // lights/toggle
        case 'toggle': {
          console.log('Handling ' + chalk.green('lights/toggle') + ' ...')

          try {
            const parsedMessage = JSON.parse(message);

            if (parsedMessage.on == null || typeof parsedMessage.on !== 'boolean') {
              return console.log('Invalid toggle format, needs to be {"on": true|false}.');
            }
            
            const on = parsedMessage.on;
            const lightID = parsedMessage.lightID;

            // Set light state
            if (parsedMessage.on === true) {
              state = state.reset().on()
              console.log(HUE_LOG + ' Light state changed to ' + chalk.green('{ON}'));
            } else {
              state = state.reset().off()
              console.log(HUE_LOG + ' Light state changed to ' + chalk.green('{OFF}'));
            }

            // Turn on/off one of the lights, or all if {lightID} not specified
            if (lightID) {
              api.setLightState(lightID, state).done();
            } else {
              api.setGroupLightState(0, state).done();
            }

          } catch (e) {
            return console.log('Error toggling light: ' + e);
          }
          break;
        }

        // lights/color
        case 'color': {
          console.log('Handling ' + chalk.green('lights/color') + ' ...');

          try {
            const parsedMessage = JSON.parse(message);

            if (parsedMessage.color !== null && Array.isArray(parsedMessage.color) && parsedMessage.color.length === 3) {
              
              const color = parsedMessage.color;
              const lightID = parsedMessage.lightID;
                            
              state = state.reset().on().rgb(color[0], color[1], color[2])
              
              if (lightID) {
                api.setLightState(lightID, state).done();
                console.log(HUE_LOG + ' Color set to ' + chalk.green('{' + parsedMessage.color.join(', ') + '}'));
              } else {
                console.log('Cannot set a RGB color to a specific light. Specify the "lightID" instead.')
              }              
            } else {
              return console.log('Invalid color format, needs to be {color: [r, g, b]}.');
            }
          } catch (e) {
            return console.log('Error changing light color: ' + e);
          }

          break;
        }
        default: {
          return console.log('Cannot handle sub-topic "' + subTopic + '"');
        }
      }
      break;
  }
    case 'config': {
      if (topicPaths.length < 2 || !topics.config.topics[topicPaths[1]]) {
        return console.log('Trying to handle /lights without valid sub-topic. ');
      }
      var subTopic = topicPaths[1];

      switch (subTopic) {
        case 'adduser': {
          function displayUserResult(user) {
            console.log('[HUE] Created new user:');
            console.log('[HUE] ' + JSON.stringify(user, null, 2));

            username = user.username
          }

          function displayError(error) {
            console.log('[HUE] Error creating new user:');
            console.log('[HUE] ' + error);
          }

          if (nodeUserExists()) {
            return console.log('[HUE] User "Node API" already exists');
          }

          HueApi.registerUser(host, name)
          .then(displayUserResult)
          .fail(displayError)
          .done();
          
          break;
        }
        default: {
          return console.log('Cannot handle sub-topic ' + subTopic);
        }
      }
    }
    default: {
        return console.log('Cannot handle topic ' + topicPaths.join('/'));
    }
  }
}

function nodeUserExists() {
  function displayResult(result) {
    var devices = result.devices;

    for (var i = 0; i < devices.length; i++) {
      if (devices[i].name === name) {
        return true;
      }
    }

    return false;
  }

  api.registeredUsers().then(displayResult).done();
}

// FIXME: Loop recursively for more flexibility
function generateActiveTopics() {
  var result = [];
  
  Object.keys(topics).forEach(function(key) {
    var arr = [];
    
    Object.keys(topics[key].topics).forEach(function(subKey) {
      arr.push([key, subKey].join('/'));
    });
    
    result.push(arr);
  });
    
  // Flatten the array to one dimension
  return [].concat.apply([], result);
}

function formattedTopics() {
  var arr = [];
  
  for (var i = 0; i < activeTopics.length; i++) {
    if (i < activeTopics.length - 2) {
      arr.push(chalk.green(activeTopics[i]) + ', ');      
    } else if (i === activeTopics.length - 2) {
      arr.push(chalk.green(activeTopics[i]));      
    } else {
      arr.push(' and ' + chalk.green(activeTopics[i]));      
    }
  }
  
  return arr.join('');
}
