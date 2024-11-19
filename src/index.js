// import styles
import '@/styles/index.scss'

import { UI } from '@/js/UI'
import { Prediction } from './js/Prediction'

import camConfig from '@/js/CameraConfig'

// store a reference to the player video
var playerVideo

// keep track of scores
var playerScore = 0,
  computerScore = 0

// flag to control game loop
let gameActive = false

// setup & initialization
// -----------------------------------------------------------------------------
async function onInit() {
  UI.init()
  UI.setStatusMessage('Initializing - Please wait a moment')

  const videoPromise = UI.initPlayerVideo(camConfig)
  const predictPromise = Prediction.init()

  console.log('Initialize game...')

  Promise.all([videoPromise, predictPromise]).then((result) => {
    // result[0] will contain the initialized video element
    playerVideo = result[0]
    playerVideo.play()

    console.log('Initialization finished')

    // Attach stop button functionality
    setupStopButton()

    // game is ready
    waitForPlayer()
  })
}

// Setup Stop Button
function setupStopButton() {
  const stopButton = document.getElementById('stopButton')
  stopButton.addEventListener('click', () => {
    gameActive = false // Stop the game loop
    playerScore = 0
    computerScore = 0
    UI.setPlayerScore(playerScore)
    UI.setRobotScore(computerScore)
    UI.setStatusMessage('Game stopped. Press any key to restart.')
    UI.stopAnimateMessage() // Stop blinking messages if any
    waitForPlayer() // Reset to waiting state
  })
}

// game logic
// -----------------------------------------------------------------------------
function waitForPlayer() {
  gameActive = false // Ensure game is inactive during the wait state

  // show a blinking start message
  if (UI.isMobile()) {
    UI.setStatusMessage('Touch the screen to start')
  } else {
    UI.setStatusMessage('Press any key to start')
  }

  UI.startAnimateMessage()

  const startGame = () => {
    UI.stopAnimateMessage()
    gameActive = true // Game starts
    playOneRound()
  }

  // wait for player to press any key
  // then stop blinking and play one round
  if (UI.isMobile()) {
    document.addEventListener('touchstart', startGame, { once: true })
  } else {
    window.addEventListener('keypress', startGame, { once: true })
  }
}

async function playOneRound() {
  if (!gameActive) return // Exit if the game is stopped

  // show robot waiting for player
  UI.showRobotImage(true)

  // hide the timer circle
  UI.showTimer(false)
  UI.setTimerProgress(0)
  UI.setPlayerHand('')

  // ready - set - show
  // wait for countdown to finish
  await UI.startCountdown()

  // show the timer circle
  UI.showTimer(true)

  // start detecting player gestures
  // required duration 150ms ~ 4-5 camera frames
  detectPlayerGesture(150)
}

function detectPlayerGesture(requiredDuration) {
  if (!gameActive) return // Exit if the game is stopped

  let lastGesture = ''
  let gestureDuration = 0

  const predictNonblocking = () => {
    if (!gameActive) return // Exit if the game is stopped

    setTimeout(() => {
      const predictionStartTS = Date.now()

      // predict gesture (require high confidence)
      Prediction.predictGesture(playerVideo, 9).then((playerGesture) => {
        if (!gameActive) return // Exit if the game is stopped

        if (playerGesture != '') {
          if (playerGesture == lastGesture) {
            // player keeps holding the same gesture
            // -> keep timer running
            const deltaTime = Date.now() - predictionStartTS
            gestureDuration += deltaTime
          } else {
            // detected a different gesture
            // -> reset timer
            UI.setPlayerHand(playerGesture)
            lastGesture = playerGesture
            gestureDuration = 0
          }
        } else {
          UI.setPlayerHand(false)
          lastGesture = ''
          gestureDuration = 0
        }

        if (gestureDuration < requiredDuration) {
          // update timer and repeat
          UI.setTimerProgress(gestureDuration / requiredDuration)
          predictNonblocking()
        } else {
          // player result available
          // -> stop timer and check winner
          UI.setTimerProgress(1)
          UI.animatePlayerHand()

          // let computer make its move
          const computerGesture = getRandomGesture()

          // check the game result
          checkResult(playerGesture, computerGesture)
        }
      })
    }, 0)
  }

  predictNonblocking()
}

function checkResult(playerGesture, computerGesture) {
  if (!gameActive) return // Exit if the game is stopped

  let statusText
  let playerWins = false
  let computerWins = false

  if (playerGesture == computerGesture) {
    // draw
    statusText = "It's a draw!"
  } else {
    // check winner
    if (playerGesture == 'rock') {
      if (computerGesture == 'scissors') {
        playerWins = true
        statusText = 'Rock beats scissors'
      } else {
        computerWins = true
        statusText = 'Paper beats rock'
      }
    } else if (playerGesture == 'paper') {
      if (computerGesture == 'rock') {
        playerWins = true
        statusText = 'Paper beats rock'
      } else {
        computerWins = true
        statusText = 'Scissors beat paper'
      }
    } else if (playerGesture == 'scissors') {
      if (computerGesture == 'paper') {
        playerWins = true
        statusText = 'Scissors beat paper'
      } else {
        computerWins = true
        statusText = 'Rock beats scissors'
      }
    }
  }

  if (playerWins) {
    playerScore++
    statusText += ' - You win!'
  } else if (computerWins) {
    computerScore++
    statusText += ' - The robot wins!'
  }

  UI.showRobotHand(true)
  UI.setRobotGesture(computerGesture)

  UI.setStatusMessage(statusText)

  UI.setPlayerScore(playerScore)
  UI.setRobotScore(computerScore)

  // wait for 3 seconds, then start next round
  setTimeout(() => {
    if (gameActive) playOneRound()
  }, 3000)
}

function getRandomGesture() {
  const gestures = ['rock', 'paper', 'scissors']
  const randomNum = Math.floor(Math.random() * gestures.length)
  return gestures[randomNum]
}

//-----
onInit()
