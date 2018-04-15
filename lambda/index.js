const Alexa = require('alexa-sdk');

const mode = 'MODE2'; // MODE1: catch a button, MODE2: catch a sequence
const COLOR_TO_CATCH = '00FF00';

function _emit(...cmd) {
  console.log('===RESPONSE=== \n' + JSON.stringify(this.handler.response, null, 2));
  this.emit(...cmd);
}

// randomly pick a button with COLOR_TO_CATCH color
function pickButton() {
  if (this.attributes.blinkPeriod > 1000) {
    this.attributes.blinkPeriod -= 500;
  }
  let buttonId = this.attributes.buttons[Math.floor(Math.random() * this.attributes.buttons.length)];
  this.response._addDirective(buildButtonIdleDirective([buttonId], this.attributes.blinkPeriod));
  this.attributes.pressedButton = buttonId;

  updateInputHandler.call(this, 10000);
}

const rgb2h = function(r, g, b) {
  return '' + n2h(r) + n2h(g) + n2h(b);
};

// Number to hex with leading zeros.
const n2h = function(n) {
  if (n > 255) n = 255;
  return ('00' + (Math.floor(n)).toString(16).toUpperCase()).substr(-2);
};

function createColorPool(size, exclusions) {
  let pool = [];
  let i = 0;
  while (i < size) {
    const red = Math.floor(Math.random() * 3) * 0x60;
    const green = Math.floor(Math.random() * 3) * 0x60;
    const blue = Math.floor(Math.random() * 3) * 0x60;

    let value = rgb2h(red, green, blue);
    if (exclusions.indexOf(value) < 0) {
      pool.push(value);
      i++;
    }
  }
  return pool;
}

function sequencePush(list, color) {
  list.push({
    'durationMs': 1500,
    'color': color,
    'blend': false
  });
}
const PATTERN = ['00C000', '0000C0', 'C00000']; // green, blue, red
const PATTERN2 = ['006000', '000060', '600000']; // lighter green, blue, red
const SEQ_SIZE = 16;

// test code with simple anim
function startAnim2() {
  let sequence1 = [];

  for (let i = 0; i < PATTERN.length; i++) {
    sequencePush(sequence1, PATTERN[i]);
  }

  this.response._addDirective(buildAnimationIdleDirective([this.attributes.buttons[0]], 4000, sequence1));
  this.response._addDirective(buildAnimationIdleDirective([this.attributes.buttons[1]], 4000, sequence1));

  setPatternInputHandler.call(this, 10000);
}

function startAnim() {
  let colorPool = createColorPool(
    SEQ_SIZE - PATTERN.length,
    PATTERN.concat(PATTERN2, ['000000', 'C0C0C0']));  // colors to exclude
  let sequence1 = [];
  let sequence2 = [];
  let pattern = PATTERN.slice();

  for (let i = 0; i < SEQ_SIZE; i += 2) {
    let adjustment = 0;
    let rnd = Math.floor(Math.random() * (SEQ_SIZE - i));
    if (rnd < pattern.length) {
      sequencePush(sequence1, pattern.splice(0, 1)[0]);
      adjustment = pattern.length;
    }
    else {
      sequencePush(sequence1, colorPool.splice(rnd - pattern.length, 1)[0]);
    }

    rnd = adjustment + Math.floor(Math.random() * (SEQ_SIZE - i - 1 - adjustment));
    if (rnd < pattern.length) {
      sequencePush(sequence2, pattern.splice(0, 1)[0]);
    }
    else {
      sequencePush(sequence2, colorPool.splice(rnd - pattern.length, 1)[0]);
    }
  }

  this.response._addDirective(
    buildAnimationIdleDirective([this.attributes.buttons[0]], 5000, sequence1));
  this.response._addDirective(
    buildAnimationIdleDirective([this.attributes.buttons[1]], 5000, sequence2));

  // cancel default blue when pressing a button
//  this.response._addDirective(buildButtonDownDirective([]));

  setPatternInputHandler.call(this, 20000);
}

function updateInputHandler(timeout) {
  this.response._addDirective({
    type: 'GameEngine.StartInputHandler',
    timeout: timeout,
    recognizers: {
      button_down_recognizer: {
        type: 'match',
        fuzzy: true,
        anchor: 'end',
        pattern: [{
          action: 'down'
        }]
      }
    },
    events: {
      button_down_event: {
        meets: ['button_down_recognizer'],
        reports: 'matches',
        shouldEndInputHandler: false
      },
      timeout: {
        meets: ['timed out'],
        reports: 'history',
        shouldEndInputHandler: true
      }
    }
  });
}

// detect a pattern of sequential colors
function setPatternInputHandler(timeout) {
  this.response._addDirective({
    type: 'GameEngine.StartInputHandler',
    timeout: timeout,
    recognizers: {
      'pattern_recognizer': {
        type: 'match',
        fuzzy: false,
        anchor: 'end',
        pattern: [
          {
            action: 'down',
            colors: [PATTERN[0]]
          },
          {
            action: 'down',
            colors: [PATTERN[1]]
          },
          {
            action: 'down',
            colors: [PATTERN[2]]
          }
        ]
      }
    },
    events: {
      'pattern_event': {
        meets: ['pattern_recognizer'],
        reports: 'matches',
        shouldEndInputHandler: false
      },
      timeout: {
        meets: ['timed out'],
        reports: 'history',
        shouldEndInputHandler: true
      }
    }
  });
}

const handlers = {
  'LaunchRequest': function() {
    delete this.handler.response.response.shouldEndSession;

    this.attributes.inputHandler_originatingRequestId = this.event.request.requestId;

    if (this.attributes.state && this.attributes.state == 'PLAYING') {

      let sentence;
      if (mode == 'MODE1') {
        this.attributes.blinkPeriod = 5000;
        pickButton.call(this);
        sentence = 'Let\'s try to catch that button.';
      }
      else {
        startAnim.call(this);
        sentence = 'Try to catch the green, blue, red sequence.';
      }

      this.response.speak('Welcome to simple button one! ' +
        'It looks like you already have your buttons initialized. ' +
        sentence);
    }
    else {
      updateInputHandler.call(this, 20000);

      this.attributes.state = 'INIT';
      this.attributes.buttons = [];
      this.response.speak('Welcome to simple button one! Press the echo buttons to register them.');
    }

    _emit.call(this, ':responseReady');
  },
  'HelloIntent': function() {
    this.response.speak('Hello there!');
    _emit.call(this, ':responseReady');
  },
  'GameEngine.InputHandlerEvent': function() {
    let gameEngineEvents = this.event.request.events || [];
    for (let i = 0; i < gameEngineEvents.length; i++) {

      let buttonId;

      switch (gameEngineEvents[i].name) {
        case 'button_down_event':
          buttonId = gameEngineEvents[i].inputEvents[0].gadgetId;

          if (this.attributes.state == 'INIT') {
            if (this.attributes[buttonId + '_initialized'] === undefined) {
              this.attributes.buttons.push(buttonId);

              /*
              this.response._addDirective(buildButtonIdleAnimationDirective([buttonId], breathAnimationRed));
              this.response._addDirective(buildButtonDownAnimationDirective([buttonId]));
              this.response._addDirective(buildButtonUpAnimationDirective([buttonId]));
              */

              this.attributes[buttonId + '_initialized'] = true;

              if (this.attributes.buttons.length < 2) {
                this.response.speak('hello, button ' + this.attributes.buttons.length);
              }
              else {
                this.attributes.state = 'PLAYING';

                this.response.speak('hello, button ' + this.attributes.buttons.length +
                                    '. Let\'s try to catch that button.');

                if (mode == 'MODE1') {
                  this.attributes.blinkPeriod = 5000;
                  pickButton.call(this);
                }
                else {
                  startAnim.call(this);
                }
              }
            }
          }
          else {

            if (buttonId == this.attributes.pressedButton &&
                gameEngineEvents[i].inputEvents[0].color == COLOR_TO_CATCH) {
              this.response.speak('Good catch');
            }
            else {
              this.response.speak('Wrong catch');
            }
            pickButton.call(this);
          }

          delete this.handler.response.response.shouldEndSession;

          _emit.call(this, ':responseReady');
          break;

        case 'pattern_event':
          this.response.speak('You got it! Congratulation.');
          this.handler.response.response.shouldEndSession = true;
          _emit.call(this, ':responseReady');
          break;

        case 'timeout':
          this.response.speak('Thank you for playing!');
          this.handler.response.response.shouldEndSession = true;
          _emit.call(this, ':responseReady');
          break;
      }
    }
  },
  'StopIntent': function() {
    console.log('StopIntent');
    this.response.speak('Good Bye!');
    _emit.call(this, ':responseReady');
  },
  'SessionEndedRequest': function() {
    _emit.call(this, ':saveState', true);
  },
  'System.ExceptionEncountered': function() {
    console.log(this.event.request.error);
    console.log(this.event.request.cause);
  },
  'Unhandled': function() {
    const msg = 'Sorry, I didn\'t get that.';
    _emit.call(this, ':ask', msg, msg);
  }
};

const buildButtonIdleDirective = function(targetGadgets, delay) {
  return {
    'type': 'GadgetController.SetLight',
    'version': 1,
    'targetGadgets': targetGadgets,
    'parameters': {
      'animations': [{
        'repeat': 1,
        'targetLights': ['1'],
        'sequence': [{
          'durationMs': 2000,
          'color': COLOR_TO_CATCH,
          'blend': false
        }]
      }],
      'triggerEvent': 'none',
      'triggerEventTimeMs': delay ? delay : 0
    }
  };
};

const buildAnimationIdleDirective = function(targetGadgets, delay, sequence) {
  return {
    'type': 'GadgetController.SetLight',
    'version': 1,
    'targetGadgets': targetGadgets,
    'parameters': {
      'animations': [{
        'repeat': 1,
        'targetLights': ['1'],
        'sequence': sequence
      }],
      'triggerEvent': 'none',
      'triggerEventTimeMs': delay ? delay : 0
    }
  };
};

const buildButtonDownDirective = function(targetGadgets) {
  return {
    'type': 'GadgetController.SetLight',
    'version': 1,
    'targetGadgets': targetGadgets,
    'parameters': {
      'animations': [{
        'repeat': 1,
        'targetLights': ['1'],
        'sequence': [{
          'durationMs': 300,
          'color': 'A0A0A0',
          'blend': false
        }]
      }],
      'triggerEvent': 'buttonDown',
      'triggerEventTimeMs': 0
    }
  };
};

exports.handler = function(event, context, callback) {
  console.log('===REQUEST=== ' + event.request.type + ':\n' + JSON.stringify(event, null, 2));

  const alexa = Alexa.handler(event, context, callback);
  alexa.appId = 'amzn1.ask.skill.dd5d4174-8397-4459-9f12-7207a7176650';
  alexa.dynamoDBTableName = 'SimpleButton1';
  alexa.registerHandlers(handlers);
  alexa.execute();
};
