// Copyright (c) 2014 The Chromium Authors. All rights reserved.
// Copyright (c) 2019 LIHKG. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// global window location query
var locationQuery;

(function () {
    'use strict';

    /**
     * T-Rex runner.
     * @param {string} outerContainerId Outer containing element id.
     * @param {Object} opt_config
     * @constructor
     * @export
     */
    function Runner(outerContainerId, opt_config) {
        // Singleton
        if (Runner.instance_) {
            return Runner.instance_;
        }
        Runner.instance_ = this;

        this.outerContainerEl = document.querySelector(outerContainerId);
        this.containerEl = null;
        this.detailsButton = this.outerContainerEl.querySelector('#details-button');

        this.config = opt_config || Runner.config;

        this.dimensions = Runner.defaultDimensions;

        this.bgCanvas = null;
        this.bgCanvasCtx = null;

        this.canvas = null;
        this.canvasCtx = null;

        this.hudCanvas = null;
        this.hudCanvasCtx = null;

        this.effectCanvas = null;
        this.effectCanvasCtx = null;

        this.tRex = null;

        this.distanceMeter = null;
        this.distanceRan = 0;

        this.highestScore = 0;

        this.time = 0;
        this.runningTime = 0;
        this.msPerFrame = 1000 / FPS;
        this.currentSpeed = this.config.SPEED;

        this.obstacles = [];

        this.activated = false; // Whether the easter egg has been activated.
        this.playing = false; // Whether the game is currently in play state.
        this.crashed = false;
        this.paused = false;
        this.resizeTimerId_ = null;

        this.playCount = 0;

        // Images.
        this.images = {};
        this.imagesLoaded = 0;

        this.loadImages();
    }
    window['Runner'] = Runner;


    /**
     * Default game width.
     * @const
     */
    var DEFAULT_WIDTH = 600;

    /**
     * Frames per second.
     * @const
     */
    var FPS = 60;

    /** @const */
    var IS_IOS = /iPad|iPhone|iPod/.test(window.navigator.platform);

    /** @const */
    var IS_MOBILE = /Android/.test(window.navigator.userAgent) || IS_IOS;

    /** @const */
    var IS_TOUCH_ENABLED = 'ontouchstart' in window;

    var CURRENT_DIFF_COEFFICIENT = 1;
    /**
     * Default game configuration.
     * @enum {number}
     */
    // Runner.config = {
    //     ACCELERATION: 0.0025,
    //     BOTTOM_PAD: 10,
    //     CLEAR_TIME: 2000,
    //     GAMEOVER_CLEAR_TIME: 750,
    //     GAP_COEFFICIENT: 0.6,
    //     GRAVITY: 0.6,
    //     INITIAL_JUMP_VELOCITY: 12,
    //     MAX_SPEED: 18,
    //     MIN_JUMP_HEIGHT: 35,
    //     EASY_SPEED_COEFFICIENT: 0.5,
    //     SPEED: 6,
    //     SPEED_DROP_COEFFICIENT: 3.5
    // };

    Runner.config = {
        ACCELERATION: 0.0025,
        BOTTOM_PAD: 10,
        CLEAR_TIME: 1000,
        GAMEOVER_CLEAR_TIME: 750,
        GAP_COEFFICIENT: 0.6,
        GRAVITY: 0.6,
        INITIAL_JUMP_VELOCITY: 12,
        MAX_SPEED: 22,
        MIN_JUMP_HEIGHT: 35,
        SPEED: 8.5,
        SPEED_DROP_COEFFICIENT: 3.5
    };


    /**
     * Default dimensions.
     * @enum {string}
     */
    Runner.defaultDimensions = {
        WIDTH: DEFAULT_WIDTH,
        HEIGHT: 150,
        INITIAL_X: 30,
    };


    /**
     * CSS class names.
     * @enum {string}
     */
    Runner.classes = {
        CANVAS: 'runner-canvas',
        CANVAS_HUD: 'hud-canvas',
        CANVAS_EFFECT: 'effect-canvas',
        CANVAS_BG: 'bg-canvas',
        CONTAINER: 'runner-container',
        CRASHED: 'crashed',
        ICON: 'icon-offline',
        TOUCH_CONTROLLER: 'controller'
    };


    /**
     * Sprite definition layout of the spritesheet.
     * @enum {Object}
     */
    Runner.spriteDefinition = {
        LDPI: {
            CACTUS_LARGE: { x: 332, y: 2 },
            CACTUS_SMALL: { x: 228, y: 2 },
            HORIZON: { x: 0, y: 15 },
            MOON: { x: 484, y: 2 },
            WIND: { x: 0, y: 0 },
            WIND_V2: { x: 0, y: 100 },
            SUITCASE_LARGE: { x: 0, y: 0 },
            SUITCASE_SMALL: { x: 0, y: 60 },
            SUITCASE_SMALL_V: { x: 0, y: 85 },
            GIPSON: { x: 0, y: 0 },
            SMILECOIN: { x: 0, y: 0 },
            TREE_A: { x: 0, y: 70 },
            TREE_B: { x: 51, y: 82 },
            TREE_C: { x: 101, y: 46 },
            TREE_D: { x: 132, y: 32 },
            TREE_A_B: { x: 0, y: 66 },
            TREE_C_D: { x: 101, y: 32 },
            LOCUST: { x: 75, y: 0 },
            LOCUST_V2: { x: 75, y: 0 },
            TANK: { x: 0, y: 24 },
            RESTART: { x: 2, y: 2 },
            TEXT_SPRITE: { x: 0, y: 0 },
            TREX: { x: 848, y: 2 },
            STAR: { x: 645, y: 2 }
        },
    };

    /**
     * Key code mapping.
     * @enum {Object}
     */
    Runner.keycodes = {
        JUMP: { '38': 1, '32': 1 },  // Up, spacebar
    };


    /**
     * Runner event names.
     * @enum {string}
     */
    Runner.events = {
        ANIM_END: 'webkitAnimationEnd',
        CLICK: 'click',
        KEYDOWN: 'keydown',
        KEYUP: 'keyup',
        MOUSEDOWN: 'mousedown',
        MOUSEUP: 'mouseup',
        RESIZE: 'resize',
        TOUCHEND: 'touchend',
        TOUCHSTART: 'touchstart',
        VISIBILITY: 'visibilitychange',
        BLUR: 'blur',
        FOCUS: 'focus',
        LOAD: 'load',
        EAT_COIN: 'eatSmilecoin'
    };

    Runner.mode = {
        undefined: 0,
        easy: 1,
        hard: 2
    }

    Runner.difficultyCoefficent = {
        easy: 0.7,
        hard: 1
    }

    Runner.prototype = {
        /**
         * Setting individual settings for debugging.
         * @param {string} setting
         * @param {*} value
         */
        updateConfigSetting: function (setting, value) {
            if (setting in this.config && value != undefined) {
                this.config[setting] = value;

                switch (setting) {
                    case 'GRAVITY':
                    case 'MIN_JUMP_HEIGHT':
                    case 'SPEED_DROP_COEFFICIENT':
                        this.tRex.config[setting] = value;
                        break;
                    case 'INITIAL_JUMP_VELOCITY':
                        this.tRex.setJumpVelocity(value);
                        break;
                    case 'SPEED':
                        this.setSpeed(value);
                        break;
                }
            }
        },

        /**
         * Cache the appropriate image sprite from the page and get the sprite sheet
         * definition.
         */
        loadImages: function () {
            var sprites = {
                gameBackground: document.getElementById('background'),
                scoresSprite: document.getElementById('scores'),
                signalsSprite: document.getElementById('signals'),
                sceneSprite: document.getElementById('scene'),
                obstacleSprite: document.getElementById('obstacle'),
                suitcasesSprite: document.getElementById('suitcases'),
                dogrunSprite: document.getElementById('dogrun'),
                gipsonSprite: document.getElementById('gipson'),
                smilecoinSprite: document.getElementById('smilecoin'),
                thunderSprite: document.getElementById('thunder'),
            };
            var load = Object.keys(sprites).map(function(key) {
                return new Promise(function(resolve) {
                    if (sprites[key].complete) {
                        Runner[key] = sprites[key]
                        resolve()
                    } else {
                        sprites[key].addEventListener(Runner.events.LOAD, function() {
                            Runner[key] = sprites[key]
                            resolve()
                        })
                    }
                })
            });

            function onLoaded() {
                this.spriteDef = Runner.spriteDefinition.LDPI;
                this.init();
            }

            Promise.all(load).then(onLoaded.bind(this));
        },

        /**
         * Sets the game speed. Adjust the speed accordingly if on a smaller screen.
         * @param {number} opt_speed
         */
        setSpeed: function (opt_speed) {
            var speed = opt_speed || this.currentSpeed;

            if (opt_speed) {
                // if (this.gameMode === Runner.mode.hard)
                //     this.currentSpeed = opt_speed;
                // else
                this.currentSpeed = opt_speed * CURRENT_DIFF_COEFFICIENT;
            }
        },

        /**
         * Game initialiser.
         */
        init: function () {
            this.gameMode = Runner.mode.undefined;


            this.containerEl = document.createElement('div');
            this.containerEl.className = Runner.classes.CONTAINER;
            this.containerEl.style.width = this.dimensions.WIDTH + 'px';

            // Background canvas container.
            this.bgCanvas = createCanvas(this.containerEl, this.dimensions.WIDTH,
                this.dimensions.HEIGHT, Runner.classes.CANVAS_BG);
            this.bgCanvasCtx = this.bgCanvas.getContext('2d');


            // Player canvas container.
            this.canvas = createCanvas(this.containerEl, this.dimensions.WIDTH,
                this.dimensions.HEIGHT, Runner.classes.PLAYER);
            this.canvasCtx = this.canvas.getContext('2d');


            this.effectCanvas = createCanvas(this.containerEl, this.dimensions.WIDTH,
                this.dimensions.HEIGHT, Runner.classes.CANVAS_EFFECT);
            this.effectCanvasCtx = this.effectCanvas.getContext('2d');
            Runner.updateCanvasScaling(this.effectCanvas);
            

            // Gameover panel canvas container.
            this.hudCanvas = createCanvas(this.containerEl, this.dimensions.WIDTH,
                this.dimensions.HEIGHT, Runner.classes.CANVAS_HUD);
            this.hudCanvasCtx = this.hudCanvas.getContext('2d');

            // Horizon contains obstacles and the ground.
            this.horizon = new Horizon(this.canvas, this.effectCanvas, this.spriteDef, this.dimensions,
                this.config.GAP_COEFFICIENT, this);

            // Distance meter
            this.distanceMeter = new DistanceMeter(this.canvas,
                this.spriteDef.TEXT_SPRITE, this.dimensions.WIDTH);

            // Draw t-rex
            this.tRex = new Trex(this.canvas, this.spriteDef.TREX);

            this.outerContainerEl.appendChild(this.containerEl);

            if (IS_MOBILE) {
                this.createTouchController();
            }

            this.adjustDimensions();
            // this.startListening();
            this.update();

            window.addEventListener(Runner.events.RESIZE,
                this.debounceResize.bind(this));

            function onGameModeSelected(){

            }
            
            var self = this;
            document.querySelector('#easyMode').onclick = function () {
                self.gameMode = Runner.mode.easy;
                CURRENT_DIFF_COEFFICIENT = Runner.difficultyCoefficent.easy;
                self.setSpeed(Runner.config.SPEED);
                self.startListening();
                self.drawGameStart();
            };

            document.querySelector('#hardMode').onclick = function () {
                self.gameMode = Runner.mode.hard;
                CURRENT_DIFF_COEFFICIENT = Runner.difficultyCoefficent.hard;
                self.setSpeed(Runner.config.SPEED);
                self.startListening();
                self.drawGameStart();
            };
        },

        /**
         * Create the touch controller. A div that covers whole screen.
         */
        createTouchController: function () {
            this.touchController = document.createElement('div');
            this.touchController.className = Runner.classes.TOUCH_CONTROLLER;
            document.body.appendChild(this.touchController);
        },

        /**
         * Debounce the resize event.
         */
        debounceResize: function () {
            if (!this.resizeTimerId_) {
                this.resizeTimerId_ =
                    setInterval(this.adjustDimensions.bind(this), 250);
            }
        },

        /**
         * Adjust game space dimensions on resize.
         */
        adjustDimensions: function () {
            clearInterval(this.resizeTimerId_);
            this.resizeTimerId_ = null;

            var boxStyles = window.getComputedStyle(this.outerContainerEl);
            var padding = Number(boxStyles.paddingLeft.substr(0,
                boxStyles.paddingLeft.length - 2));

            this.dimensions.WIDTH = this.outerContainerEl.offsetWidth - padding * 2;

            // Redraw the elements back onto the canvas.
            if (this.canvas) {
                this.canvas.width = this.dimensions.WIDTH;
                this.canvas.height = this.dimensions.HEIGHT;

                Runner.updateCanvasScaling(this.canvas);
                this.clearCanvas();
                this.drawGameStart();

                this.distanceMeter.calcXPos(this.dimensions.WIDTH);
                this.horizon.update(0, 0, true);
                this.tRex.update(0);

                this.containerEl.style.width = this.dimensions.WIDTH + 'px';
                this.containerEl.style.height = this.dimensions.HEIGHT + 'px';
                this.distanceMeter.update(0, Math.ceil(this.distanceRan));

                // Outer container and distance meter.
                if (this.playing || this.crashed || this.paused) {
                    this.stop();
                } else {
                    this.tRex.draw(0, 0);
                }

                // Game over panel.
                if (this.crashed && this.gameOverPanel) {
                    this.gameOverPanel.updateDimensions(this.dimensions.WIDTH);
                    this.gameOverPanel.draw();
                }
            }

            if (this.hudCanvas) {
                this.hudCanvas.width = this.dimensions.WIDTH;
                this.hudCanvas.height = this.dimensions.HEIGHT;
                Runner.updateCanvasScaling(this.hudCanvas);
                this.clearHudCanvas();
            }

            if (this.bgCanvas) {
                this.bgCanvas.width = this.dimensions.WIDTH;
                this.bgCanvas.height = this.dimensions.HEIGHT;
                Runner.updateCanvasScaling(this.bgCanvas);
                this.drawBackground();
            }

            if (this.effectCanvas) {
                this.effectCanvas.width = this.dimensions.WIDTH;
                this.effectCanvas.height = this.dimensions.HEIGHT;
                Runner.updateCanvasScaling(this.effectCanvas);
                this.effectCanvasCtx.clearRect(0, 0, this.dimensions.WIDTH, this.dimensions.HEIGHT);
            }
        },

        /**
         * Update the game status to started.
         */
        startGame: function () {
            var mode = (this.gameMode === Runner.mode.easy) ? 'Easy' : 'Hard';
            setTimeout( function() {
	    	window.ga('send', 'event', 'start_game_'+mode, locationQuery.username || '(GUEST)')
            }, 50);
	    this.playing = true;
            this.activated = true;
            this.runningTime = 0;
            this.playCount++;

            if (locationQuery.ref === 'app') {
                window.location.href = 'runningdog://lockrotation'
            }

            // Handle tabbing off the page. Pause the current game.
            document.addEventListener(Runner.events.VISIBILITY,
                this.onVisibilityChange.bind(this));

            window.addEventListener(Runner.events.BLUR,
                this.onVisibilityChange.bind(this));

            window.addEventListener(Runner.events.FOCUS,
                this.onVisibilityChange.bind(this));
        },

        clearCanvas: function () {
            this.canvasCtx.clearRect(0, 0, this.dimensions.WIDTH, this.dimensions.HEIGHT);
        },

        clearHudCanvas: function () {
            this.hudCanvasCtx.clearRect(0, 0, this.dimensions.WIDTH, this.dimensions.HEIGHT);
        },

        drawBackground: function () {
            this.bgCanvasCtx.save()
            this.bgCanvasCtx.fillStyle = '#fff';
            this.bgCanvasCtx.fillRect(0, 0, this.bgCanvas.width, this.bgCanvas.height);
            this.bgCanvasCtx.drawImage(Runner.gameBackground,
                0, 0, this.bgCanvas.width, this.bgCanvas.height,
                0, 0, this.bgCanvas.width, this.bgCanvas.height);
            this.bgCanvasCtx.restore();
        },

        drawGameStart: function() {
            if (this.playing || this.crashed || this.gameMode === Runner.mode.undefined) {
                return
            }
            this.canvasCtx.save()
            this.canvasCtx.fillStyle = '#000';
            this.canvasCtx.fillRect(0, 0, this.canvasCtx.width, this.canvasCtx.height);
            // start game text
            var str = IS_MOBILE ? '點擊畫面開始遊戲' : '按下空白鍵開始遊戲';
            var centerX = this.dimensions.WIDTH / 2;
            var centerY = this.dimensions.HEIGHT / 2;
            this.canvasCtx.textAlign = 'center';
            this.canvasCtx.font = '16px Arial';
            this.canvasCtx.lineWidth = 2;
            this.canvasCtx.strokeStyle = '#fff';
            this.canvasCtx.strokeText(str, centerX, centerY);
            this.canvasCtx.fillStyle = '#000';
            this.canvasCtx.fillText(str, centerX, centerY);
            this.canvasCtx.restore();

            document.querySelector('#difficulty').classList.add('hidden');
        },

        /**
         * Update the game frame and schedules the next one.
         */
        update: function () {
            this.updatePending = false;

            var now = getTimeStamp();
            if (this.playing) {
                var timeDiff = now - this.timeBeforeUpdate;
                if (timeDiff > 100) {
                    this.time += timeDiff - 1000 / FPS;
                }
            }
            var deltaTime = now - (this.time || now);
            this.time = now;

            if (this.playing) {
                this.clearCanvas();
                this.clearHudCanvas();

                if (this.tRex.jumping) {
                    this.tRex.updateJump(deltaTime);
                }

                this.runningTime += deltaTime;
                var hasObstacles = this.runningTime > this.config.CLEAR_TIME;

                // Start the game.
                if (this.tRex.jumpCount == 1 && !this.activated) {
                    this.startGame();
                }

                // The horizon doesn't move until the intro is over.
                deltaTime = !this.activated ? 0 : deltaTime;
                this.horizon.update(deltaTime, this.currentSpeed, hasObstacles);

                // Check for collisions.
                var collision = false;
                var theObstacle;
                if (hasObstacles){
                    for (var i = 0; i < this.horizon.obstacles.length; i++){
                        theObstacle = this.horizon.obstacles[i];
                        collision = checkForCollision(theObstacle, this.tRex);
                        if (collision)
                            break;
                    }
                }

                if (!collision) {
                    this.distanceRan += this.currentSpeed * deltaTime / this.msPerFrame;

                    if (this.currentSpeed < this.config.MAX_SPEED * CURRENT_DIFF_COEFFICIENT) {
                        var acceleration = this.config.ACCELERATION * CURRENT_DIFF_COEFFICIENT;
                        var speed = this.currentSpeed / CURRENT_DIFF_COEFFICIENT;
                        if (speed > 12){
                            if (speed < 16)
                                acceleration = acceleration * 0.5;
                            else
                                acceleration = acceleration * 0.25;
                        }
                        this.currentSpeed += acceleration;
                    }
                } else {
                    if (theObstacle.typeConfig.type === 'GIPSON') {
                        theObstacle.crashAnimation = true;
                        theObstacle.draw();
                        this.tRex.jumping = false;
                        this.tRex.slowDrop = true;
                        this.tRex.startMegaJump(this.currentSpeed);
                    } else if (theObstacle.typeConfig.type ==='WIND') {
                        this.tRex.setSpeedDrop(4);
                    } else if (theObstacle.typeConfig.type.indexOf('SMILECOIN') === 0) {
                        theObstacle.remove = true
                        window.dispatchEvent(new CustomEvent(Runner.events.EAT_COIN, {
                            detail: this.tRex.yPos,
                        }))
                    } else {
                        this.gameOver();
                    }
                }

                this.distanceMeter.update(deltaTime, Math.ceil(this.distanceRan));
            }

            if (this.playing) {
                this.tRex.update(deltaTime);
                this.scheduleNextUpdate();
            }
        },

        /**
         * Event handler.
         */
        handleEvent: function (e) {
            return (function (evtType, events) {
                switch (evtType) {
                    case events.KEYDOWN:
                    case events.TOUCHSTART:
                    case events.MOUSEDOWN:
                        this.onKeyDown(e);
                        break;
                    case events.KEYUP:
                    case events.TOUCHEND:
                    case events.MOUSEUP:
                        this.onKeyUp(e);
                        break;
                }
            }.bind(this))(e.type, Runner.events);
        },

        /**
         * Bind relevant key / mouse / touch listeners.
         */
        startListening: function () {
            // Keys.
            document.addEventListener(Runner.events.KEYDOWN, this);
            document.addEventListener(Runner.events.KEYUP, this);

            if (IS_MOBILE) {
                // Mobile only touch devices.
                this.touchController.addEventListener(Runner.events.TOUCHSTART, this);
                this.touchController.addEventListener(Runner.events.TOUCHEND, this);
                this.containerEl.addEventListener(Runner.events.TOUCHSTART, this);
            } else {
                // Mouse.
                document.addEventListener(Runner.events.MOUSEDOWN, this);
                document.addEventListener(Runner.events.MOUSEUP, this);
            }
        },

        /**
         * Remove all listeners.
         */
        stopListening: function () {
            document.removeEventListener(Runner.events.KEYDOWN, this);
            document.removeEventListener(Runner.events.KEYUP, this);

            if (IS_MOBILE) {
                this.touchController.removeEventListener(Runner.events.TOUCHSTART, this);
                this.touchController.removeEventListener(Runner.events.TOUCHEND, this);
                this.containerEl.removeEventListener(Runner.events.TOUCHSTART, this);
            } else {
                document.removeEventListener(Runner.events.MOUSEDOWN, this);
                document.removeEventListener(Runner.events.MOUSEUP, this);
            }
        },

        /**
         * Process keydown.
         * @param {Event} e
         */
        onKeyDown: function (e) {
            // Prevent native page scrolling whilst tapping on mobile.
            if (IS_MOBILE && this.playing) {
                e.preventDefault();
            }

            if (e.target != this.detailsButton) {
                if (!this.crashed && (Runner.keycodes.JUMP[e.keyCode] ||
                    e.type == Runner.events.TOUCHSTART)) {
                    if (!this.playing) {
                        this.playing = true;
                        this.timeBeforeUpdate = getTimeStamp();
                        this.update();
                    }
                    
                    if (!this.tRex.jumping) {
                        if (!this.didTriggerJump){
                            this.tRex.startJump(this.currentSpeed);
                            this.didTriggerJump = true;
                        }
                    } else if (!this.tRex.megaJumping) {
                        // Speed drop, activated only when jump key is not pressed.
                        this.tRex.setSpeedDrop();
                    }
                }
                //  Jump on starting the game for the first time.
                if (this.crashed && e.type == Runner.events.TOUCHSTART &&
                    e.currentTarget == this.containerEl) {
                    this.restart();
                }
            }
        },


        /**
         * Process key up.
         * @param {Event} e
         */
        onKeyUp: function (e) {
            var keyCode = String(e.keyCode);
            var isjumpKey = Runner.keycodes.JUMP[keyCode] ||
                e.type == Runner.events.TOUCHEND ||
                e.type == Runner.events.MOUSEDOWN;

            if (this.isRunning() && isjumpKey) {
                this.tRex.endJump();
            } else if (this.crashed) {
                // Check that enough time has elapsed before allowing jump key to restart.
                var deltaTime = getTimeStamp() - this.time;
                if (this.isLeftClickOnCanvas(e) ||
                    (deltaTime >= this.config.GAMEOVER_CLEAR_TIME &&
                        Runner.keycodes.JUMP[keyCode])) {
                    this.restart();
                }
            } else if (this.paused && isjumpKey) {
                // Reset the jump state
                this.tRex.reset();
                this.play();
            }

            this.didTriggerJump = false;
        },

        /**
         * Returns whether the event was a left click on canvas.
         * On Windows right click is registered as a click.
         * @param {Event} e
         * @return {boolean}
         */
        isLeftClickOnCanvas: function (e) {
            return e.type === 'touchend' || (e.button != null && e.button < 2 &&
                e.type == Runner.events.MOUSEUP && e.target == this.canvas);
        },

        /**
         * RequestAnimationFrame wrapper.
         */
        scheduleNextUpdate: function () {
            if (!this.updatePending) {
                this.updatePending = true;
                this.timeBeforeUpdate = getTimeStamp();
                this.raqId = requestAnimationFrame(this.update.bind(this));
            }
        },

        /**
         * Whether the game is running.
         * @return {boolean}
         */
        isRunning: function () {
            return !!this.raqId;
        },

        /**
         * Game over state.
         */
        gameOver: function () {
            vibrate(200);

            this.stop();
            this.crashed = true;
            this.distanceMeter.acheivement = false;
            this.distanceMeter.isGameOver = true;
            this.distanceMeter.draw();
            this.gameOverTime = Date.now()

            this.tRex.update(100, Trex.status.CRASHED);

            if (locationQuery.ref === 'app') {
                window.location.href = 'runningdog://unlockrotation'
            }

            // Game over panel.
            if (!this.gameOverPanel) {
                this.gameOverPanel = new GameOverPanel(this.bgCanvas, this.canvas, this.hudCanvas,
                    this.spriteDef.TEXT_SPRITE, this.spriteDef.RESTART,
                    this.dimensions, this);
            } else {
                this.gameOverPanel.draw();
            }

            // Update the high score.
            if (this.distanceRan > this.highestScore) {
                this.highestScore = Math.ceil(this.distanceRan);
            }

            var score = this.distanceMeter.getActualDistance(this.highestScore);
            var mode = (this.gameMode === Runner.mode.easy) ? 'Easy' : 'Hard';
            setTimeout(function() {
	    	window.ga('send', 'event', 'end_game_'+mode, locationQuery.username || '(GUEST)', score);
	    }, 50);
            // Reset the time clock.
            this.time = getTimeStamp();
        },

        stop: function () {
            this.playing = false;
            this.paused = true;
            cancelAnimationFrame(this.raqId);
            this.raqId = 0;
        },

        play: function () {
            if (!this.crashed) {
                this.playing = true;
                this.paused = false;
                this.tRex.update(0, Trex.status.RUNNING);
                this.time = getTimeStamp();
                this.timeBeforeUpdate = getTimeStamp();
                this.update();
            }
        },

        restart: function () {
            if (Date.now() - this.gameOverTime < 750) {
                return
            }

            if (!this.raqId) {
                if (locationQuery.ref === 'app') {
                    window.location.href = 'runningdog://lockrotation'
                }
                var mode = (this.gameMode === Runner.mode.easy) ? 'Easy' : 'Hard';
		setTimeout( function() {
			window.ga('send', 'event', 'start_game_'+mode, locationQuery.username || '(GUEST)');
                }, 50);
		document.querySelector('#toggleShowName').classList.add('hidden');
                document.querySelector('#navScreenshot').classList.add('hidden');
                document.querySelector('#difficultyButton').classList.add('hidden');
                document.querySelector('#navScreenshot').removeAttribute('data-score');
                delete this.gameOverTime;
                this.playCount++;
                this.runningTime = 0;
                this.playing = true;
                this.crashed = false;
                this.distanceRan = 0;
                this.setSpeed(this.config.SPEED);
                this.time = getTimeStamp();
                this.timeBeforeUpdate = getTimeStamp();
                this.containerEl.classList.remove(Runner.classes.CRASHED);
                this.clearCanvas();
                this.clearHudCanvas();
                this.distanceMeter.reset(this.highestScore);
                this.horizon.reset();
                this.tRex.reset();
                this.update();
            }
        },

        /**
         * Pause the game if the tab is not in focus.
         */
        onVisibilityChange: function (e) {
            if (document.hidden || document.webkitHidden || e.type == 'blur' ||
                document.visibilityState != 'visible') {
                this.stop();
            } else if (!this.crashed) {
                // this.tRex.reset();
                this.play();
            }
        },
    };


    /**
     * Updates the canvas size taking into
     * account the backing store pixel ratio and
     * the device pixel ratio.
     *
     * See article by Paul Lewis:
     * http://www.html5rocks.com/en/tutorials/canvas/hidpi/
     *
     * @param {HTMLCanvasElement} canvas
     * @param {number} opt_width
     * @param {number} opt_height
     * @return {boolean} Whether the canvas was scaled.
     */
    Runner.updateCanvasScaling = function (canvas, opt_width, opt_height) {
        var context = canvas.getContext('2d');

        // Query the various pixel ratios
        var devicePixelRatio = Math.floor(window.devicePixelRatio) || 1;
        var backingStoreRatio = Math.floor(context.webkitBackingStorePixelRatio) || 1;
        var ratio = devicePixelRatio / backingStoreRatio;

        // Upscale the canvas if the two ratios don't match
        if (devicePixelRatio !== backingStoreRatio) {
            var oldWidth = opt_width || canvas.width;
            var oldHeight = opt_height || canvas.height;

            canvas.width = oldWidth * ratio;
            canvas.height = oldHeight * ratio;

            canvas.style.width = oldWidth + 'px';
            canvas.style.height = oldHeight + 'px';

            // Scale the context to counter the fact that we've manually scaled
            // our canvas element.
            context.imageSmoothingEnabled = false;
            context.scale(ratio, ratio);
            return true;
        } else if (devicePixelRatio == 1) {
            // Reset the canvas width / height. Fixes scaling bug when the page is
            // zoomed and the devicePixelRatio changes accordingly.
            canvas.style.width = canvas.width + 'px';
            canvas.style.height = canvas.height + 'px';
        }

        return false;
    };


    /**
     * Get random number.
     * @param {number} min
     * @param {number} max
     * @param {number}
     */
    function getRandomNum(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }


    /**
     * Vibrate on mobile devices.
     * @param {number} duration Duration of the vibration in milliseconds.
     */
    function vibrate(duration) {
        if (IS_MOBILE && window.navigator.vibrate) {
            window.navigator.vibrate(duration);
        }
    }


    /**
     * Create canvas element.
     * @param {HTMLElement} container Element to append canvas to.
     * @param {number} width
     * @param {number} height
     * @param {string} opt_classname
     * @return {HTMLCanvasElement}
     */
    function createCanvas(container, width, height, opt_classname) {
        var canvas = document.createElement('canvas');
        canvas.className = opt_classname ? Runner.classes.CANVAS + ' ' +
            opt_classname : Runner.classes.CANVAS;
        canvas.width = width;
        canvas.height = height;
        container.appendChild(canvas);

        return canvas;
    }

    /**
     * Return the current timestamp.
     * @return {number}
     */
    function getTimeStamp() {
        return IS_IOS ? new Date().getTime() : performance.now();
    }


    //******************************************************************************

    /**
     * Game over panel.
     * @param {!HTMLCanvasElement} canvas
     * @param {Object} textImgPos
     * @param {Object} restartImgPos
     * @param {!Object} dimensions Canvas dimensions.
     * @constructor
     */
    function GameOverPanel(bgCanvas, canvas, hudCanvas, textImgPos, restartImgPos, dimensions, rootcls) {
        this.bgCanvas = bgCanvas;
        this.bgCanvasCtx = bgCanvas.getContext('2d');
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.hudCanvas = hudCanvas;
        this.hudCanvasCtx = hudCanvas.getContext('2d');
        this.canvasDimensions = dimensions;
        this.textImgPos = textImgPos;
        this.restartImgPos = restartImgPos;
        this.rootcls = rootcls;
        this.draw();
    };


    /**
     * Dimensions used in the panel.
     * @enum {number}
     */
    GameOverPanel.dimensions = {
        TEXT_X: 35,
        TEXT_Y: 13,
        TEXT_WIDTH: 24,
        TEXT_HEIGHT: 26,
    };


    GameOverPanel.prototype = {
        /**
         * Update the panel dimensions.
         * @param {number} width New canvas width.
         * @param {number} opt_height Optional new canvas height.
         */
        updateDimensions: function (width, opt_height) {
            this.canvasDimensions.WIDTH = width;
            if (opt_height) {
                this.canvasDimensions.HEIGHT = opt_height;
            }
        },

        /**
         * Draw the panel.
         */
        draw: function () {
            var self = this;
            var dimensions = GameOverPanel.dimensions;

            var centerX = self.canvasDimensions.WIDTH / 2;

            // Game over text.
            var textSourceX = dimensions.TEXT_X;
            var textSourceY = dimensions.TEXT_Y;

            var textTargetX = Math.round(centerX - (dimensions.TEXT_WIDTH / 2));
            var textTargetY = Math.round(self.canvasDimensions.HEIGHT / 10);
            var iconWidth = dimensions.TEXT_WIDTH;
            var iconHeight = dimensions.TEXT_HEIGHT;

            textSourceX += self.textImgPos.x;
            textSourceY += self.textImgPos.y;

            var score = self.rootcls.distanceMeter.getActualDistance(self.rootcls.distanceRan);

            function drawStr(ctx, str, fs, color, y) {
                ctx.save()
                ctx.textAlign = 'center';
                ctx.font = fs + 'px Arial';
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#fff';
                ctx.strokeText(str, centerX, y);
                ctx.fillStyle = color;
                ctx.fillText(str, centerX, y);
                ctx.restore()
            }

            var withUsername = false;
            document.querySelector('#toggleShowName').onclick = function () {
                withUsername = !withUsername;
                document.querySelector('#toggleShowName').innerHTML = (withUsername ? '隱藏' : '顯示') + '名稱';

                // Clear HUD
                self.hudCanvasCtx.clearRect(0, 0, self.canvasDimensions.WIDTH, self.canvasDimensions.HEIGHT);
                // Draw Text
                var username = withUsername && locationQuery.username ? '「' + locationQuery.username + '」' : '你';
                var hard = self.rootcls.gameMode === Runner.mode.hard;
                var color = hard ? '#a00' : '#000';
                var str = hard ? '（困難）' : '（簡單）';
                drawStr.call(self, self.hudCanvasCtx, username + '今日跑咗 ' + score + ' 米' + str, 14, color, textTargetY + iconHeight * 2.25);

                // Game over text
                var padding = 8;
                var title = '又 要 遲 到 了';
                self.hudCanvasCtx.save()
                self.hudCanvasCtx.textAlign = 'center';
                self.hudCanvasCtx.font = '16px Arial';
                self.hudCanvasCtx.lineWidth = 3;
                self.hudCanvasCtx.strokeStyle = '#555';
                self.hudCanvasCtx.strokeText(title, centerX + (iconWidth / 2) + (padding / 2), textTargetY + (iconHeight / 2) + (16 / 2));
                self.hudCanvasCtx.fillStyle = '#ff0';
                self.hudCanvasCtx.fillText(title, centerX + (iconWidth / 2) + (padding / 2), textTargetY + (iconHeight / 2) + (16 / 2));
                var textWidth = self.hudCanvasCtx.measureText(title).width;
                self.hudCanvasCtx.restore()


                // Game over dog icon
                self.hudCanvasCtx.drawImage(Runner.scoresSprite,
                        textSourceX, textSourceY, iconWidth, iconHeight,
                        centerX - (iconWidth / 2) - (textWidth / 2) - (padding / 2), textTargetY, iconWidth, iconHeight);

                // Overlay HUD on canvas
                var tmpCanvas = document.createElement('canvas');
                tmpCanvas.width = self.canvas.width;
                tmpCanvas.height = self.canvas.height;
                var tmpCtx = tmpCanvas.getContext('2d');
                tmpCtx.drawImage(self.bgCanvas, 0, 0);
                tmpCtx.drawImage(self.canvas, 0, 0);
                tmpCtx.drawImage(self.hudCanvas, 0, 0);
                // Update share href
                if (locationQuery.ref === 'app') {
                    document.querySelector('#navScreenshot').href = 'runningdog://screencap?' + tmpCanvas.toDataURL('image/png');
                } else {
                    if (navigator.userAgent.indexOf('iPhone OS 9') > 0) {
                        document.querySelector('#navScreenshot').href = tmpCanvas.toDataURL('image/png');
                    } else {
                        tmpCanvas.toBlob(function (blob) {
                            document.querySelector('#navScreenshot').href = URL.createObjectURL(blob);
                        });
                    }
                }
            };

            // Show after mispress prevention delay
            setTimeout(function () {
                var str = IS_MOBILE ? '點擊畫面再次挑戰' : '按下空白鍵再次挑戰';
                drawStr.call(self, self.canvasCtx, str, 12, '#666', textTargetY + iconHeight * 3.25)
                // Redraw after tap text show
                withUsername = !withUsername;
                document.querySelector('#toggleShowName').click();
                document.querySelector('#difficultyButton').classList.remove('hidden');
            }, 750);

            // RAF to wait for typhoon signal draw
            window.requestAnimationFrame((function() {
                if (locationQuery.username) {
                    document.querySelector('#toggleShowName').classList.remove('hidden');
                } else {
                    document.querySelector('#navScreenshot').classList.add('single');
                }
                // Trigger first toggle
                document.querySelector('#toggleShowName').click();
                document.querySelector('#navScreenshot').classList.remove('hidden');

                //var mode = (this.gameMode === Runner.mode.easy) ? 'Easy' : 'Hard';
                var mode = (this.rootcls.gameMode === Runner.mode.easy) ? 'Easy' : 'Hard';
		document.querySelector('#navScreenshot').setAttribute('data-score', score);
                document.querySelector('#navScreenshot').setAttribute('data-mode', mode);
            }).bind(this));
        }
    };


    //******************************************************************************

    /**
     * Check for a collision.
     * @param {!Obstacle} obstacle
     * @param {!Trex} tRex T-rex object.
     * @param {HTMLCanvasContext} opt_canvasCtx Optional canvas context for drawing
     *    collision boxes.
     * @return {Array<CollisionBox>}
     */
    function checkForCollision(obstacle, tRex, opt_canvasCtx) {
        var obstacleBoxXPos = Runner.defaultDimensions.WIDTH + obstacle.xPos;

        // Adjustments are made to the bounding box as there is a 1 pixel white
        // border around the t-rex and obstacles.
        var tRexBox = new CollisionBox(
            tRex.xPos + 1,
            tRex.yPos + 1,
            tRex.config.WIDTH - 2,
            tRex.config.HEIGHT - 2);

        var obstacleBox = new CollisionBox(
            obstacle.xPos + 1,
            obstacle.yPos + 1,
            obstacle.typeConfig.width - 2,
            obstacle.typeConfig.height - 2);

        // Debug outer box
        // if (opt_canvasCtx) {
        //     drawCollisionBoxes(opt_canvasCtx, tRexBox, obstacleBox);
        // }

        // Simple outer bounds check.
        if (boxCompare(tRexBox, obstacleBox)) {
            var collisionBoxes = obstacle.collisionBoxes;
            var tRexCollisionBoxes = Trex.collisionBoxes.RUNNING;

            // Detailed axis aligned box check.
            for (var t = 0; t < tRexCollisionBoxes.length; t++) {
                for (var i = 0; i < collisionBoxes.length; i++) {
                    // Adjust the box to actual positions.
                    var adjTrexBox =
                        createAdjustedCollisionBox(tRexCollisionBoxes[t], tRexBox);
                    var adjObstacleBox =
                        createAdjustedCollisionBox(collisionBoxes[i], obstacleBox);
                    var crashed = boxCompare(adjTrexBox, adjObstacleBox);

                    // Draw boxes for debug.
                    if (opt_canvasCtx) {
                        drawCollisionBoxes(opt_canvasCtx, adjTrexBox, adjObstacleBox);
                    }

                    if (crashed) {
                        return [adjTrexBox, adjObstacleBox];
                    }
                }
            }
        }
        return false;
    };


    /**
     * Adjust the collision box.
     * @param {!CollisionBox} box The original box.
     * @param {!CollisionBox} adjustment Adjustment box.
     * @return {CollisionBox} The adjusted collision box object.
     */
    function createAdjustedCollisionBox(box, adjustment) {
        return new CollisionBox(
            box.x + adjustment.x,
            box.y + adjustment.y,
            box.width,
            box.height);
    };


    /**
     * Draw the collision boxes for debug.
     */
    function drawCollisionBoxes(canvasCtx, tRexBox, obstacleBox) {
        canvasCtx.save();
        canvasCtx.strokeStyle = '#f00';
        canvasCtx.strokeRect(tRexBox.x, tRexBox.y, tRexBox.width, tRexBox.height);

        canvasCtx.strokeStyle = '#0f0';
        canvasCtx.strokeRect(obstacleBox.x, obstacleBox.y,
            obstacleBox.width, obstacleBox.height);
        canvasCtx.restore();
    };


    /**
     * Compare two collision boxes for a collision.
     * @param {CollisionBox} tRexBox
     * @param {CollisionBox} obstacleBox
     * @return {boolean} Whether the boxes intersected.
     */
    function boxCompare(tRexBox, obstacleBox) {
        var crashed = false;
        var tRexBoxX = tRexBox.x;
        var tRexBoxY = tRexBox.y;

        var obstacleBoxX = obstacleBox.x;
        var obstacleBoxY = obstacleBox.y;

        // Axis-Aligned Bounding Box method.
        if (tRexBox.x < obstacleBoxX + obstacleBox.width &&
            tRexBox.x + tRexBox.width > obstacleBoxX &&
            tRexBox.y < obstacleBox.y + obstacleBox.height &&
            tRexBox.height + tRexBox.y > obstacleBox.y) {
            crashed = true;
        }

        return crashed;
    };


    //******************************************************************************

    /**
     * Collision box object.
     * @param {number} x X position.
     * @param {number} y Y Position.
     * @param {number} w Width.
     * @param {number} h Height.
     */
    function CollisionBox(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
    };


    //******************************************************************************

    /**
     * Obstacle.
     * @param {HTMLCanvasCtx} canvasCtx
     * @param {Obstacle.type} type
     * @param {Object} spritePos Obstacle position in sprite.
     * @param {Object} dimensions
     * @param {number} gapCoefficient Mutipler in determining the gap.
     * @param {number} speed
     * @param {number} opt_xOffset
     */
    function Obstacle(canvasCtx, type, spriteImgPos, dimensions,
        gapCoefficient, speed, opt_xOffset) {
        // dimensions.width = DEFAULT_WIDTH;
        this.canvasCtx = canvasCtx;
        this.spritePos = spriteImgPos;
        this.typeConfig = type;
        this.gapCoefficient = gapCoefficient;
        var realDimensions = Object.assign({}, dimensions, {
            WIDTH: DEFAULT_WIDTH,
        });
        this.dimensions = realDimensions;
        this.remove = false;
        this.xPos = realDimensions.WIDTH + (opt_xOffset || 0);
        this.yPos = 0;
        this.width = 0;
        this.collisionBoxes = [];
        this.gap = 0;
        this.speedOffset = 0;

        // For animated obstacles.
        this.currentFrame = 0;
        this.timer = 0;

        this.init(speed);
    };

    /**
     * Coefficient for calculating the maximum gap.
     * @const
     */
    Obstacle.MAX_GAP_COEFFICIENT = 1.5;

        Obstacle.prototype = {
            /**
             * Initialise the DOM for the obstacle.
             * @param {number} speed
             */
            init: function (speed) {
                this.cloneCollisionBoxes();

                this.spriteOriginX = this.spritePos.x;
                if (this.typeConfig.type.indexOf('SUITCASE') === 0 && this.typeConfig.type !== 'SUITCASE_SMALL_V') {
                    // different color suitcases
                    this.spriteOriginX += getRandomNum(0, 2) * this.typeConfig.width
                }

                this.width = this.typeConfig.width;

                // Check if obstacle can be positioned at various heights.
                if (Array.isArray(this.typeConfig.yPos)) {
                    var yPosConfig = this.typeConfig.yPos;
                    this.yPos = yPosConfig[getRandomNum(0, yPosConfig.length - 1)];
                } else {
                    this.yPos = this.typeConfig.yPos;
                }

                // If obstacle is flyable
                this.flying = this.typeConfig.flying;
                if (this.flying) {
                    this.flyDirection = 1
                }

                this.draw();

                // For obstacles that go at a different speed from the horizon.
                if (this.typeConfig.speedOffset) {
                    this.speedOffset = Math.random() > 0.5 ? this.typeConfig.speedOffset :
                        -this.typeConfig.speedOffset;
                }

                this.gap = this.getGap(this.gapCoefficient, speed);
            },

            /**
             * Draw and crop based on size.
             */
            draw: function () {
                var sourceWidth = this.typeConfig.width;
                var sourceHeight = this.typeConfig.height;

                // X position in sprite.
                var sourceX = this.spriteOriginX;

                // Animation frames.
                if (this.currentFrame > 0) {
                    sourceX += sourceWidth * this.currentFrame;
                }

                var sprite;

                if (this.typeConfig.type.indexOf('SUITCASE') === 0) {
                    sprite = Runner.suitcasesSprite
                } else if (this.typeConfig.type.indexOf('TREE') === 0) {
                    sprite = Runner.obstacleSprite
                } else if (this.typeConfig.type.indexOf('WIND') === 0) {
                    sprite = Runner.obstacleSprite
                } else if (this.typeConfig.type.indexOf('LOCUST') === 0) {
                    sprite = Runner.obstacleSprite
                } else if (this.typeConfig.type === 'TANK') {
                    sprite = Runner.obstacleSprite
                } else if (this.typeConfig.type === 'GIPSON') {
                    sprite = Runner.gipsonSprite
                } else if (this.typeConfig.type.indexOf('SMILECOIN') === 0) {
                    sprite = Runner.smilecoinSprite
                }

                if (this.flying) {
                    if (this.flyDirection < 0) {
                        // fly up
                        this.yPos -= 1
                        if (this.yPos < 0) {
                            this.flyDirection = 1
                        }
                    } else if (this.flyDirection > 0) {
                        // fly down
                        this.yPos += 1
                        if (this.yPos > this.dimensions.HEIGHT - this.typeConfig.height - 15) {
                            this.flyDirection = -1
                        }
                    }
                }

                if (this.crashAnimation && this.typeConfig.transformed) {
                    var transformed = this.typeConfig.transformed;
                    this.canvasCtx.drawImage(sprite,
                        transformed.x, transformed.y,
                        transformed.width, transformed.height,
                        this.xPos, this.yPos,
                        this.typeConfig.width, this.typeConfig.height);
                } else {
                    this.canvasCtx.drawImage(sprite,
                        sourceX, this.spritePos.y,
                        sourceWidth, sourceHeight,
                        this.xPos, this.yPos,
                        this.typeConfig.width, this.typeConfig.height);
                }
            },

            /**
             * Obstacle frame update.
             * @param {number} deltaTime
             * @param {number} speed
             */
            update: function (deltaTime, speed) {
                if (!this.remove) {
                    if (this.typeConfig.speedOffset) {
                        speed += (this.speedOffset * (CURRENT_DIFF_COEFFICIENT / Runner.difficultyCoefficent.easy));
                    }
                    this.xPos -= Math.floor((speed * FPS / 1000) * deltaTime);

                    // Update frame
                    if (this.typeConfig.numFrames) {
                        this.timer += deltaTime;
                        if (this.timer >= this.typeConfig.frameRate) {
                            this.currentFrame =
                                this.currentFrame == this.typeConfig.numFrames - 1 ?
                                    0 : this.currentFrame + 1;
                            this.timer = 0;
                        }
                    }
                    this.draw();

                    if (!this.isVisible()) {
                        this.remove = true;
                    }
                }
            },

            /**
             * Calculate a random gap size.
             * - Minimum gap gets wider as speed increses
             * @param {number} gapCoefficient
             * @param {number} speed
             * @return {number} The gap size.
             */
            getGap: function (gapCoefficient, speed) {
                var minGap = Math.round(this.width * (speed / CURRENT_DIFF_COEFFICIENT) +
                    this.typeConfig.minGap * gapCoefficient) * (Runner.difficultyCoefficent.easy / CURRENT_DIFF_COEFFICIENT);
                var maxGap = Math.round(minGap * Obstacle.MAX_GAP_COEFFICIENT) * (Runner.difficultyCoefficent.easy / CURRENT_DIFF_COEFFICIENT);
                return getRandomNum(minGap, maxGap);
            },

            /**
             * Check if obstacle is visible.
             * @return {boolean} Whether the obstacle is in the game area.
             */
            isVisible: function () {
                return this.xPos + this.width > 0;
            },

            /**
             * Make a copy of the collision boxes, since these will change based on
             * obstacle type and size.
             */
            cloneCollisionBoxes: function () {
                var collisionBoxes = this.typeConfig.collisionBoxes;

                for (var i = collisionBoxes.length - 1; i >= 0; i--) {
                    this.collisionBoxes[i] = new CollisionBox(collisionBoxes[i].x,
                        collisionBoxes[i].y, collisionBoxes[i].width,
                        collisionBoxes[i].height);
                }
            }
        };


    /**
     * Obstacle definitions.
     * minGap: minimum pixel space betweeen obstacles.
     * speedOffset: speed faster / slower than the horizon.
     * minSpeed: Minimum speed which the obstacle can make an appearance.
     */
    Obstacle.types = [
        {
            type: 'SUITCASE_LARGE',
            width: 32,
            height: 60,
            yPos: 80,
            minGap: 0,
            minSpeed: 8 ,
            maxSpeed: 17,
            collisionBoxes: [
                new CollisionBox(10, 0, 21, 13),
                new CollisionBox(3, 13, 28, 6),
                new CollisionBox(0, 19, 32, 41),
            ],
        },
        {
            type: 'SUITCASE_SMALL',
            width: 42,
            height: 25,
            yPos: 114, 
            minGap: 100,
            minSpeed: 0,
            maxSpeed: 11,
            collisionBoxes: [
                new CollisionBox(2, 0, 31, 25),
                new CollisionBox(33, 1, 9, 17),
            ],
        },
        {
            type: 'SUITCASE_SMALL_V',
            width: 75,
            height: 48,
            yPos: 95,
            minGap: 100,
            minSpeed: 11,
            maxSpeed: 99,
            collisionBoxes: [
                new CollisionBox(7, 0, 67, 12),
                new CollisionBox(3, 12, 71, 4),
                new CollisionBox(0, 16, 75, 32),
            ],
        },
        {
            type: 'WIND',
            width: 24,
            height: 24,
            yPos: [40, 60, 80], // Variable height.
            minGap: 50,
            minSpeed: 7,
            maxSpeed: 16,
            collisionBoxes: [
                new CollisionBox(5, 5, 15, 15),
            ],
            numFrames: 3,
            frameRate: 1000 / 10,
            speedOffset: 2,
        },
        {
            type: 'WIND_V2',
            width: 24,
            height: 24,
            yPos: [30, 55, 90], // Variable height.
            minGap: 30,
            minSpeed: 16,
            maxSpeed: 999,
            collisionBoxes: [
                new CollisionBox(5, 5, 15, 15),
            ],
            numFrames: 3,
            frameRate: 1000 / 10,
            speedOffset: 2.2,
            flying: true,
        },
        {
            type: 'TREE_A',
            width: 51,
            height: 30,
            yPos: 105,
            minGap: 100,
            minSpeed: 0,
            maxSpeed: 10,
            collisionBoxes: [
                new CollisionBox(4, 15, 13, 15),
                new CollisionBox(17, 1, 10, 29),
                new CollisionBox(27, 7, 10, 23),
                new CollisionBox(37, 13, 14, 17),
            ],
        },
        {
            type: 'TREE_B',
            width: 50,
            height: 18,
            yPos: 120, 
            minGap: 100,
            minSpeed: 0,
            maxSpeed: 10,
            collisionBoxes: [
                new CollisionBox(2, 0, 45, 18),
            ],
        },
        {
            type: 'TREE_C',
            width: 31,
            height: 54,
            yPos: 90,
            minGap: 100,
            minSpeed: 7,
            maxSpeed: 12,
            collisionBoxes: [
                new CollisionBox(7, 1, 16, 9),
                new CollisionBox(7, 10, 24, 7),
                new CollisionBox(7, 17, 13, 31),
                new CollisionBox(2, 48, 21, 6),
            ],
        },
        {
            type: 'TREE_D',
            width: 40,
            height: 68,
            yPos: 75,
            minGap: 85,
            minSpeed: 7,
            maxSpeed: 15,
            collisionBoxes: [
                new CollisionBox(14, 1, 15, 9),
                new CollisionBox(0, 10, 29, 13),
                new CollisionBox(13, 23, 22, 13),
                new CollisionBox(13, 36, 17, 24),
                new CollisionBox(4, 60, 31, 8),
            ],
        },
        {
            type: 'TREE_A_B',
            width: 101,
            height: 30,
            yPos: 105,
            minGap: 100,
            minSpeed: 10,
            maxSpeed: 14,
            collisionBoxes: [
                new CollisionBox(4, 15, 13, 15),
                new CollisionBox(17, 1, 10, 29),
                new CollisionBox(27, 7, 10, 23),
                new CollisionBox(37, 13, 14, 17),
                new CollisionBox(51, 13, 47, 17),
            ],
        },
        {
            type: 'TREE_C_D',
            width: 71,
            height: 68,
            yPos: 75,
            minGap: 95,
            minSpeed: 15,
            maxSpeed: 22,
            collisionBoxes: [
                new CollisionBox(6, 14, 25, 54),
                new CollisionBox(31, 10, 14, 58),
                new CollisionBox(45, 4, 15, 64),
                new CollisionBox(60, 24, 6, 44),
            ],
        },
        {
            type: 'LOCUST',
            width: 41,
            height: 28,
            yPos: [30, 60, 90], 
            minGap: 80,
            minSpeed: 9,
            maxSpeed: 99,
            collisionBoxes: [
                new CollisionBox(5, 11, 34, 10),
                new CollisionBox(2, 21, 36, 7),
            ],
            numFrames: 2,
            frameRate: 1000 / 10,
            speedOffset: 2.0,
        },
        {
            type: 'LOCUST_V2',
            width: 41,
            height: 28,
            yPos: [20, 30, 45, 65, 85], // Variable height.
            minGap: 320,
            minSpeed: 12,
            maxSpeed: 999,
            collisionBoxes: [
                new CollisionBox(5, 11, 34, 10),
                new CollisionBox(2, 21, 36, 7),
            ],
            numFrames: 2,
            frameRate: 1000 / 10,
            speedOffset: 1.8,
            flying: true,
        },
        {
            type: 'TANK',
            width: 75,
            height: 39,
            yPos: 100,
            minGap: 400,
            minSpeed: 12,
            maxSpeed: 999,
            collisionBoxes: [
                new CollisionBox(0, 4, 51, 35),
                new CollisionBox(51, 7, 12, 32),
                new CollisionBox(63, 20, 8, 19),
                new CollisionBox(71, 23, 4, 7),
            ],
            speedOffset: 2.2,
        },
        {
            type: 'GIPSON',
            width: 34,
            height: 33,
            yPos: 105, // Variable height.
            minGap: 70,
            minSpeed: 10,
            maxSpeed: 20,
            collisionBoxes: [
                new CollisionBox(7, 1, 20, 14),
            ],
            numFrames: 2,
            frameRate: 1000 / 10,
            transformed: {x: 68, y: 0, width: 34, height: 33}
        },
        {
            type: 'SMILECOIN',
            width: 15,
            height: 15,
            yPos: 110,
            minGap: 20,
            minSpeed: 0,
            maxSpeed: 999,
            numFrames: 8,
            frameRate: 1000 / 15,
            collisionBoxes: [
                new CollisionBox(0, 0, 15, 15),
            ]
        }
    ];

    //******************************************************************************
    /**
     * T-rex game character.
     * @param {HTMLCanvas} canvas
     * @param {Object} spritePos Positioning within image sprite.
     * @constructor
     */
    function Trex(canvas, spritePos) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.spritePos = spritePos;
        this.xPos = 0;
        this.yPos = 0;
        // Position when on the ground.
        this.groundYPos = 0;
        this.currentFrame = 0;
        this.currentAnimFrames = [];
        this.animStartTime = 0;
        this.timer = 0;
        this.msPerFrame = 1000 / FPS;
        this.config = Trex.config;
        // Current status.
        this.status = Trex.status.WAITING;

        this.jumping = false;
        this.jumpVelocity = 0;
        this.reachedMinHeight = false;
        this.speedDrop = false;
        this.jumpCount = 0;
        this.jumpspotX = 0;

        this.init();
    };


    /**
     * T-rex player config.
     * @enum {number}
     */
    Trex.config = {
        DROP_VELOCITY: -5,
        GRAVITY: 0.6,
        HEIGHT: 32,
        INIITAL_JUMP_VELOCITY: -10,
        MAX_JUMP_HEIGHT: 30,
        MIN_JUMP_HEIGHT: 30,
        SPEED_DROP_COEFFICIENT: 3,
        WIDTH: 45,
    };


    /**
     * Used in collision detection.
     * @type {Array<CollisionBox>}
     */
    Trex.collisionBoxes = {
        RUNNING: [
            new CollisionBox(22, 1, 17, 20),
            new CollisionBox(1, 18, 30, 6),
            new CollisionBox(1, 24, 29, 5),
            // new CollisionBox(2 , 4, 41, 24),
        ]
    };


    /**
     * Animation states.
     * @enum {string}
     */
    Trex.status = {
        CRASHED: 'CRASHED',
        JUMPING: 'JUMPING',
        RUNNING: 'RUNNING',
        WAITING: 'WAITING'
    };

    /**
     * Animation config for different states.
     * @enum {Object}
     */
    Trex.animFrames = {
        WAITING: {
            frames: [0],
            msPerFrame: 1000 / 3
        },
        RUNNING: {
            frames: [0, 45, 90, 135, 180, 225],
            msPerFrame: 1000 / 30
        },
        CRASHED: {
            frames: [270],
            msPerFrame: 1000 / 60
        },
        JUMPING: {
            frames: [0],
            msPerFrame: 1000 / 60
        },
    };


    Trex.prototype = {
        /**
         * T-rex player initaliser.
         */
        init: function () {
            this.groundYPos = Runner.defaultDimensions.HEIGHT - this.config.HEIGHT -
                Runner.config.BOTTOM_PAD;
            this.xPos = Runner.defaultDimensions.INITIAL_X;
            this.yPos = this.groundYPos;
            this.minJumpHeight = this.groundYPos - this.config.MIN_JUMP_HEIGHT;

            this.draw(0, 0);
            this.update(0, Trex.status.WAITING);
        },

        /**
         * Setter for the jump velocity.
         * The approriate drop velocity is also set.
         */
        setJumpVelocity: function (setting) {
            this.config.INIITAL_JUMP_VELOCITY = -setting;
            this.config.DROP_VELOCITY = -setting / 2;
        },

        /**
         * Set the animation status.
         * @param {!number} deltaTime
         * @param {Trex.status} status Optional status to switch to.
         */
        update: function (deltaTime, opt_status) {
            this.timer += deltaTime;

            // Update the status.
            if (opt_status) {
                this.status = opt_status;
                this.currentFrame = 0;
                this.msPerFrame = Trex.animFrames[opt_status].msPerFrame;
                this.currentAnimFrames = Trex.animFrames[opt_status].frames;

                if (opt_status == Trex.status.WAITING) {
                    this.animStartTime = getTimeStamp();
                }
            }

            if (this.status != Trex.status.WAITING) {
                this.draw(this.currentAnimFrames[this.currentFrame], 0);
            }

            // Update the frame position.
            if (this.timer >= this.msPerFrame) {
                this.currentFrame = this.currentFrame ==
                    this.currentAnimFrames.length - 1 ? 0 : this.currentFrame + 1;
                this.timer = 0;
            }

            // Speed drop if the down key is still being pressed.
            if (this.speedDrop && this.yPos == this.groundYPos) {
                this.speedDrop = false;
            }
        },

        /**
         * Draw the t-rex to a particular position.
         * @param {number} x
         * @param {number} y
         */
        draw: function (x, y) {
            var sourceX = x;
            var sourceY = y;
            var sourceWidth = this.config.WIDTH;
            var sourceHeight = this.config.HEIGHT;

            // Adjustments for sprite sheet position.
            // sourceX += this.spritePos.x;
            // sourceY += this.spritePos.y;

            // Standing / running
            this.canvasCtx.drawImage(Runner.dogrunSprite, sourceX, sourceY,
                sourceWidth, sourceHeight,
                this.xPos, this.yPos,
                this.config.WIDTH, this.config.HEIGHT);
        },

        /**
         * Initialise a jump.
         * @param {number} speed
         */
        startJump: function (speed) {
            if (!this.jumping) {
                this.update(0, Trex.status.JUMPING);
                // Tweak the jump velocity based on the speed.
                this.jumpVelocity = this.config.INIITAL_JUMP_VELOCITY - (speed / 10);
                this.jumping = true;
                this.reachedMinHeight = false;
                this.speedDrop = false;
            }
        },

        startMegaJump: function (speed) {
            if (!this.jumping) {
                this.update(0, Trex.status.JUMPING);
                // Tweak the jump velocity based on the speed.
                this.jumpVelocity = this.config.INIITAL_JUMP_VELOCITY - speed * 3;
                this.jumping = true;
                this.megaJumping = true;
                this.reachedMinHeight = false;
                this.speedDrop = false;
            }
        },

        /**
         * Jump is complete, falling down.
         */
        endJump: function () {
            if (this.reachedMinHeight &&
                this.jumpVelocity < this.config.DROP_VELOCITY) {
                this.jumpVelocity = this.config.DROP_VELOCITY;
            }
        },

        /**
         * Update frame for a jump.
         * @param {number} deltaTime
         * @param {number} speed
         */
        updateJump: function (deltaTime, speed) {
            var msPerFrame = Trex.animFrames[this.status].msPerFrame;
            var framesElapsed = deltaTime / msPerFrame;

            // Speed drop makes Trex fall faster.
            if (this.slowDrop) {
                this.yPos += Math.round(this.jumpVelocity * 0.25 * framesElapsed);
            } else if (this.speedDrop) {
                this.yPos += Math.round(this.jumpVelocity *
                    this.config.SPEED_DROP_COEFFICIENT * framesElapsed);
            } else {
                this.yPos += Math.round(this.jumpVelocity * framesElapsed);
            }

            this.jumpVelocity += this.config.GRAVITY * framesElapsed;

            if (this.megaJumping) {
                // Minimum height has been reached.
                if (this.yPos < -50) {
                    this.reachedMinHeight = true;
                }
            } else {
                // Minimum height has been reached.
                if (this.yPos < this.minJumpHeight || this.speedDrop) {
                    this.reachedMinHeight = true;
                }
            }



            // Reached max height
            if (this.yPos < this.config.MAX_JUMP_HEIGHT || this.speedDrop) {
                this.endJump();
            }

            // Back down at ground level. Jump completed.
            if (this.yPos > this.groundYPos) {
                this.reset();
                this.jumpCount++;
            }

            this.update(deltaTime);
        },

        /**
         * Set the speed drop. Immediately cancels the current jump.
         */
        setSpeedDrop: function (velocity) {
            this.speedDrop = true;
            this.slowDrop = false;
            this.megaJumping = false;
            this.jumpVelocity = velocity || 1;
        },

        /**
         * Reset the t-rex to running at start of game.
         */
        reset: function () {
            this.yPos = this.groundYPos;
            this.jumpVelocity = 0;
            this.jumping = false;
            this.update(0, Trex.status.RUNNING);
            this.midair = false;
            this.speedDrop = false;
            this.slowDrop = false;
            this.megaJumping = false;
            this.jumpCount = 0;
        }
    };


    //******************************************************************************

    /**
     * Handles displaying the distance meter.
     * @param {!HTMLCanvasElement} canvas
     * @param {Object} spritePos Image position in sprite.
     * @param {number} canvasWidth
     * @constructor
     */
    function DistanceMeter(canvas, spritePos, canvasWidth) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.spritePos = spritePos;
        this.x = 0;
        this.y = 0;

        this.isGameOver = false;
        this.currentDistance = 0;
        this.smilecoinsCount = 0;
        this.maxScore = 0;
        this.container = null;

        this.digits = [];
        this.acheivement = false;
        this.defaultString = '';
        this.flashTimer = 0;
        this.flashIterations = 0;

        this.config = DistanceMeter.config;
        this.maxScoreUnits = this.config.MAX_DISTANCE_UNITS;
        this.init(canvasWidth);
    };


    /**
     * @enum {number}
     */
    DistanceMeter.dimensions = {
        PLUSONE: 34,
        SCORES: 68,
        WIDTH: 8,
        HEIGHT: 13,
        DEST_WIDTH: 8
    };


    /**
     * Y positioning of the digits in the sprite sheet.
     * X position is always 0.
     * @type {Array<number>}
     */
    DistanceMeter.yPos = [0, 13, 27, 40, 53, 67, 80, 93, 107, 120];


    /**
     * Distance meter config.
     * @enum {number}
     */
    DistanceMeter.config = {
        // Number of digits.
        MAX_DISTANCE_UNITS: 5,

        // Distance that causes achievement animation.
        ACHIEVEMENT_DISTANCE: 100,

        // Used for conversion from pixel distance to a scaled unit.
        COEFFICIENT: 0.03,

        // Flash duration in milliseconds.
        FLASH_DURATION: 1000 / 4,

        // Flash iterations for achievement animation.
        FLASH_ITERATIONS: 0
    };

    DistanceMeter.prototype = {
        /**
         * Initialise the distance meter to '00000'.
         * @param {number} width Canvas width in px.
         */
        init: function (width) {
            var maxDistanceStr = '';

            this.calcXPos(width);
            this.maxScore = this.maxScoreUnits;
            for (var i = 0; i < this.maxScoreUnits; i++) {
                this.draw(i, 0);
                this.defaultString += '0';
                maxDistanceStr += '9';
            }
            this.animatePlusOneMax = 20;
            this.animatePlusOne = 0;
            this.typhoonScore = 0;
            this.smilecoinsCount = 0;
            this.drawTyphoonSignal();

            this.maxScore = parseInt(maxDistanceStr);
            window.addEventListener(Runner.events.EAT_COIN, this);
        },

        /**
         * Calculate the xPos in the canvas.
         * @param {number} canvasWidth
         */
        calcXPos: function (canvasWidth) {
            this.x = canvasWidth - (DistanceMeter.dimensions.DEST_WIDTH *
                (this.maxScoreUnits + 1));
        },

        /**
         * Draw a digit to canvas.
         * @param {number} digitPos Position of the digit.
         * @param {number} value Digit value 0-9.
         */
        draw: function (digitPos, value) {
            if (this.isGameOver) {
                return
            }

            var sourceWidth = DistanceMeter.dimensions.WIDTH;
            var sourceHeight = DistanceMeter.dimensions.HEIGHT;
            var sourceX = DistanceMeter.dimensions.SCORES + DistanceMeter.dimensions.WIDTH * value;
            var sourceY = 0;

            var targetX = digitPos * DistanceMeter.dimensions.DEST_WIDTH;
            var targetY = this.y;
            var targetWidth = DistanceMeter.dimensions.WIDTH;
            var targetHeight = DistanceMeter.dimensions.HEIGHT;

            sourceX += this.spritePos.x;
            sourceY += this.spritePos.y;

            this.canvasCtx.save();

            this.canvasCtx.translate(this.x, this.y);

            this.canvasCtx.drawImage(Runner.scoresSprite, 0, sourceY,
                DistanceMeter.dimensions.SCORES, sourceHeight,
                -DistanceMeter.dimensions.SCORES - 6, targetY,
                DistanceMeter.dimensions.SCORES, targetHeight
            );

            this.canvasCtx.drawImage(Runner.scoresSprite, sourceX, sourceY,
                sourceWidth, sourceHeight,
                targetX, targetY,
                targetWidth, targetHeight
            );

            this.canvasCtx.restore();

            if (this.animatePlusOne > 0) {
                this.canvasCtx.drawImage(Runner.scoresSprite, 0, 13,
                    34, 20,
                    Runner.defaultDimensions.INITIAL_X + Trex.config.WIDTH / 2 - DistanceMeter.dimensions.PLUSONE / 2,
                    Math.max(this.tRexY - 50, this.animatePlusOneMax) + this.animatePlusOne,
                    DistanceMeter.dimensions.PLUSONE, 20
                );
                this.animatePlusOne -= this.animatePlusOneMax * 0.01
            }
        },

        /**
         * Covert pixel distance to a 'real' distance.
         * @param {number} distance Pixel distance ran.
         * @return {number} The 'real' distance ran.
         */
        getActualDistance: function (distance) {
            return (distance ? Math.round(distance * this.config.COEFFICIENT) : 0) + this.smilecoinsCount * 20;
        },

        /**
         * Update the distance meter.
         * @param {number} distance
         * @param {number} deltaTime
         * @return {void}
         */
        update: function (deltaTime, distance) {
            var paint = true;

            if (!this.acheivement) {
                distance = this.getActualDistance(distance);
                // Score has gone beyond the initial digit count.
                if (distance > this.maxScore && this.maxScoreUnits ==
                    this.config.MAX_DISTANCE_UNITS) {
                    this.maxScoreUnits++;
                    this.maxScore = parseInt(this.maxScore + '9');
                } else {
                    this.distance = 0;
                }

                if (distance > 0) {
                    // Acheivement unlocked
                    if (distance % this.config.ACHIEVEMENT_DISTANCE == 0) {
                        // Flash score.
                        this.acheivement = true;
                        this.flashTimer = 0;
                    }

                    // Create a string representation of the distance with leading 0.
                    var distanceStr = (this.defaultString +
                        distance).substr(-this.maxScoreUnits);
                    this.digits = distanceStr.split('');
                    this.typhoonScore = distance;
                } else {
                    this.digits = this.defaultString.split('');
                }
            } else {
                // Control flashing of the score on reaching acheivement.
                if (this.flashIterations <= this.config.FLASH_ITERATIONS) {
                    this.flashTimer += deltaTime;

                    if (this.flashTimer < this.config.FLASH_DURATION) {
                        paint = false;
                    } else if (this.flashTimer >
                        this.config.FLASH_DURATION * 2) {
                        this.flashTimer = 0;
                        this.flashIterations++;
                    }
                } else {
                    this.acheivement = false;
                    this.flashIterations = 0;
                    this.flashTimer = 0;
                }
            }

            // Draw the digits if not flashing.
            if (paint) {
                for (var i = this.digits.length - 1; i >= 0; i--) {
                    this.draw(i, parseInt(this.digits[i]));
                }
                this.drawTyphoonSignal(distance);
            }
        },

        handleEvent: function (e) {
            return (function (evtType, events) {
                switch (evtType) {
                    case Runner.events.EAT_COIN:
                        this.onEatCoin(e, e.detail);
                        break;
                }
            }.bind(this))(e.type, Runner.events);
        },

        onEatCoin: function (e, yPos){
            this.smilecoinsCount += 1;
            this.animatePlusOne = this.animatePlusOneMax; // frames
            this.tRexY = yPos;
        },

        /**
         * Draw typhoon signal to canvas.
         */
        drawTyphoonSignal: function () {
            var sourceX = -1
            var siginalsWidth = 26;
            if (this.typhoonScore > 4000) {
                sourceX = siginalsWidth * 4
            } else if (this.typhoonScore > 2000) {
                sourceX = siginalsWidth * 3
            } else if (this.typhoonScore > 1000) {
                sourceX = siginalsWidth * 2
            } else if (this.typhoonScore > 400) {
                sourceX = siginalsWidth * 1
            } else if (this.typhoonScore > 100) {
                sourceX = 0
            }

            if (sourceX < 0) {
                return
            }

            var canvasWidth = this.x + (DistanceMeter.dimensions.DEST_WIDTH *
                (this.maxScoreUnits + 1));

            this.canvasCtx.imageSmoothingEnabled = false;
            this.canvasCtx.drawImage(Runner.signalsSprite, sourceX, 0,
                siginalsWidth, 14,
                canvasWidth - 38, 26,
                26, 14
            );
        },

        /**
         * Reset the distance meter back to '00000'.
         */
        reset: function () {
            this.update(0);
            this.isGameOver = false;
            this.acheivement = false;
            this.smilecoinsCount = 0;
        }
    };

    //******************************************************************************

    /**
     * Horizon Line.
     * Consists of two connecting lines. Randomly assigns a flat / bumpy horizon.
     * @param {HTMLCanvasElement} canvas
     * @param {Object} spritePos Horizon position in sprite.
     * @constructor
     */
    function HorizonLine(canvas, spritePos) {
        this.spritePos = spritePos;
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.sourceDimensions = {};
        this.dimensions = HorizonLine.dimensions;
        this.sourceXPos = [this.spritePos.x, this.spritePos.x +
            this.dimensions.WIDTH];
        this.xPos = [];
        this.yPos = 0;
        this.bumpThreshold = 0.5;

        this.setSourceDimensions();
        this.draw();
    };

    /**
     * Horizon line dimensions.
     * @enum {number}
     */
    HorizonLine.dimensions = {
        WIDTH: 600,
        HEIGHT: 24,
        YPOS: 127
    };

    HorizonLine.prototype = {
        /**
         * Set the source dimensions of the horizon line.
         */
        setSourceDimensions: function () {

            for (var dimension in HorizonLine.dimensions) {
                this.sourceDimensions[dimension] =
                        HorizonLine.dimensions[dimension];
                this.dimensions[dimension] = HorizonLine.dimensions[dimension];
            }

            this.xPos = [0, HorizonLine.dimensions.WIDTH];
            this.yPos = HorizonLine.dimensions.YPOS;
        },

        /**
         * Return the crop x position of a type.
         */
        getRandomType: function () {
            return Math.random() > this.bumpThreshold ? this.dimensions.WIDTH : 0;
        },

        /**
         * Draw the horizon line.
         */
        draw: function () {
            this.canvasCtx.drawImage(Runner.sceneSprite, this.sourceXPos[0],
                this.spritePos.y,
                this.sourceDimensions.WIDTH, this.sourceDimensions.HEIGHT,
                this.xPos[0], this.yPos,
                this.dimensions.WIDTH, this.dimensions.HEIGHT);

            this.canvasCtx.drawImage(Runner.sceneSprite, this.sourceXPos[1],
                this.spritePos.y,
                this.sourceDimensions.WIDTH, this.sourceDimensions.HEIGHT,
                this.xPos[1], this.yPos,
                this.dimensions.WIDTH, this.dimensions.HEIGHT);
        },

        /**
         * Update the x position of an indivdual piece of the line.
         * @param {number} pos Line position.
         * @param {number} increment
         */
        updateXPos: function (pos, increment) {
            var line1 = pos;
            var line2 = pos == 0 ? 1 : 0;

            this.xPos[line1] -= increment;
            this.xPos[line2] = this.xPos[line1] + this.dimensions.WIDTH;

            if (this.xPos[line1] <= -this.dimensions.WIDTH) {
                this.xPos[line1] += this.dimensions.WIDTH * 2;
                this.xPos[line2] = this.xPos[line1] - this.dimensions.WIDTH;
                this.sourceXPos[line1] = this.getRandomType() + this.spritePos.x;
            }
        },

        /**
         * Update the horizon line.
         * @param {number} deltaTime
         * @param {number} speed
         */
        update: function (deltaTime, speed) {
            var increment = Math.floor(speed * (FPS / 1000) * deltaTime);

            if (this.xPos[0] <= 0) {
                this.updateXPos(0, increment);
            } else {
                this.updateXPos(1, increment);
            }
            this.draw();
        },

        /**
         * Reset horizon to the starting position.
         */
        reset: function () {
            this.xPos[0] = 0;
            this.xPos[1] = HorizonLine.dimensions.WIDTH;
        }
    };


    //******************************************************************************
    Thunder.config = {
        MAX_BG_ALPHA: 0.3,
        MAX_FLASH_ALPHA: 0.9,
        MAX_FLASH_COUNT: 3,
        TRANSITION_SPEED: 0.003,
    }

    Thunder.status = {
        STOPEED: 0,
        DARKING: 1,
        FLASHING: 2,
        LIGHTING: 3,
    }

    function Thunder(effectCanvas, dimensions, rootcls){
        this.effectCanvas = effectCanvas; 
        this.effectCanvasCtx = effectCanvas.getContext('2d');
        this.dimensions = dimensions;
        this.rootcls = rootcls;
    }


    Thunder.prototype = {
        init: function () {
            this.status = Thunder.status.STOPEED;
            this.bgAlpha = 0;
            this.flashAlpha = 0;
            this.flashCount = 0;
        },

        isTriggered: function (){
            return this.status !== Thunder.status.STOPEED;
        },

        start: function(currentSpeed){
            if (!this.isTriggered()){
                this.status = Thunder.status.DARKING;
                this.bgAlpha = 0;
                this.flashAlpha = Thunder.config.MAX_FLASH_ALPHA;
                this.flashCount = 0;
                // this.maxFlashCount = getRandomNum(0, Thunder.config.MAX_FLASH_COUNT - 1);
                var speed = currentSpeed;
                if (speed < 13){
                    this.maxFlashCount = 1;
                }else if (speed < 15){
                    this.maxFlashCount = 2;
                }else{
                    this.maxFlashCount = 3;
                }
                this.update();
            }
        },

        end: function(){
            this.status = Thunder.status.STOPEED;
            if (this.bgAlpha > 0){
                this.bgAlpha = 0;
                this.draw();
            }
        },

        update: function(){
            if (this.isTriggered()){
                if (this.status === Thunder.status.DARKING){
                    this.bgAlpha += (Thunder.config.TRANSITION_SPEED * CURRENT_DIFF_COEFFICIENT);
                    if (this.bgAlpha > Thunder.config.MAX_BG_ALPHA){
                        this.status = Thunder.status.FLASHING;
                    }
                }else if (this.status === Thunder.status.FLASHING){
                    this.flashAlpha -= 0.02;
                    if (this.flashAlpha <= Thunder.config.MAX_FLASH_ALPHA * 0.5
                        && this.flashCount < this.maxFlashCount - 1){
                        this.flashAlpha = Thunder.config.MAX_FLASH_ALPHA;
                        this.flashCount ++;
                    }else if (this.flashAlpha <= 0){
                        this.status = Thunder.status.LIGHTING;
                    }
                }else if (this.status === Thunder.status.LIGHTING){
                    this.bgAlpha -= (Thunder.config.TRANSITION_SPEED * 2 * CURRENT_DIFF_COEFFICIENT);
                }
                this.draw();
            }
        },

        draw: function(){
            this.effectCanvasCtx.clearRect(0, 0, this.dimensions.WIDTH, this.dimensions.HEIGHT);
            if (this.bgAlpha > 0){
                this.effectCanvasCtx.save();
                this.effectCanvasCtx.fillStyle = '#000000';
                this.effectCanvasCtx.globalAlpha = this.bgAlpha;
                this.effectCanvasCtx.fillRect(0, 0, this.effectCanvas.width, this.effectCanvas.height);
                if (this.status === Thunder.status.FLASHING){
                    this.effectCanvasCtx.globalAlpha = this.flashAlpha;
                    if (this.rootcls.gameMode == Runner.mode.hard){
                        this.effectCanvasCtx.drawImage(Runner.thunderSprite ,
                        1200 - 600 * (this.flashCount % 2), 0, this.effectCanvas.width, this.effectCanvas.height,
                        0, 0, this.effectCanvas.width, this.effectCanvas.height);
                    }else{
                        this.effectCanvasCtx.drawImage(Runner.thunderSprite ,
                            600 * (this.flashCount % 2), 0, this.effectCanvas.width, this.effectCanvas.height,
                            0, 0, this.effectCanvas.width, this.effectCanvas.height);
                    }
                }
                this.effectCanvasCtx.restore();
            }else{
                this.end();
            }
        },
    }
    /**
     * Horizon background class.
     * @param {HTMLCanvasElement} canvas
     * @param {Object} spritePos Sprite positioning.
     * @param {Object} dimensions Canvas dimensions.
     * @param {number} gapCoefficient
     * @constructor
     */
    function Horizon(canvas, effectCanvas, spritePos, dimensions, gapCoefficient, rootcls) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.effectCanvas = effectCanvas;
        this.effectCanvasCtx = effectCanvas.getContext('2d');
        this.effectCanvasCtx.globalAlpha = 0;
        this.config = Horizon.config;
        this.dimensions = dimensions;
        this.gapCoefficient = gapCoefficient;
        this.obstacles = [];
        this.obstacleHistory = [];
        this.horizonOffsets = [0, 0];
        this.spritePos = spritePos;
        this.rootcls = rootcls;
        // Horizon
        this.horizonLine = null;
        this.init();
    };

    /**
     * Horizon config.
     * @enum {number}
     */
    Horizon.config = {
        BUMPY_THRESHOLD: .3,
        HORIZON_HEIGHT: 16,
    };


    Horizon.prototype = {
        /**
         * Initialise the horizon. Just add the line. No obstacles.
         */
        init: function () {
            this.horizonLine = new HorizonLine(this.canvas, this.spritePos.HORIZON);
            this.thunder = new Thunder(this.effectCanvas, this.dimensions, this.rootcls);
        },

        /**
         * @param {number} deltaTime
         * @param {number} currentSpeed
         * @param {boolean} updateObstacles Used as an override to prevent
         *     the obstacles from being updated / added. This happens in the
         *     ease in section.
         */
        update: function (deltaTime, currentSpeed, updateObstacles) {
            this.runningTime += deltaTime;
            this.horizonLine.update(deltaTime, currentSpeed);

            if (updateObstacles) {
                this.updateObstacles(deltaTime, currentSpeed);
            }
            this.thunder.update();
        },

        /**
         * Update the obstacle positions.
         * @param {number} deltaTime
         * @param {number} currentSpeed
         */
        updateObstacles: function (deltaTime, currentSpeed) {
            // Obstacles, move to Horizon layer.
            var updatedObstacles = this.obstacles.slice(0);

            for (var i = 0; i < this.obstacles.length; i++) {
                var obstacle = this.obstacles[i];
                obstacle.update(deltaTime, currentSpeed);

                // Clean up existing obstacles.
                if (obstacle.remove) {
                    updatedObstacles.shift();
                }
            }
            this.obstacles = updatedObstacles;

            if (this.obstacles.length > 0) {
                var lastObstacle = this.obstacles[this.obstacles.length - 1];

                if (lastObstacle && !lastObstacle.followingObstacleCreated &&
                    lastObstacle.isVisible() &&
                    (lastObstacle.xPos + lastObstacle.width + lastObstacle.gap) < DEFAULT_WIDTH) {
                    this.addNewObstacle(currentSpeed);
                    lastObstacle.followingObstacleCreated = true;
                }
            } else {
                // Create new obstacles.
                this.addNewObstacle(currentSpeed);
            }
        },

        removeFirstObstacle: function () {
            this.obstacles.shift();
        },

        /**
         * Add a new obstacle.
         * @param {number} currentSpeed
         */
        addNewObstacle: function (currentSpeed, lastObstacleTypeIndex) {
            if (currentSpeed === 0) return;

            var obstacleTypeIndex;
            lastObstacleTypeIndex = lastObstacleTypeIndex || -1;
            if (lastObstacleTypeIndex < 0) {
                obstacleTypeIndex = getRandomNum(0, Obstacle.types.length - 1);
            } else {
                obstacleTypeIndex = (lastObstacleTypeIndex + 1) % Obstacle.types.length;
            }
            var obstacleType = Obstacle.types[obstacleTypeIndex];

            // Also check obstacle is available at current speed.
            if (currentSpeed < obstacleType.minSpeed * CURRENT_DIFF_COEFFICIENT
                || currentSpeed > obstacleType.maxSpeed * CURRENT_DIFF_COEFFICIENT) {
                this.addNewObstacle(currentSpeed, lastObstacleTypeIndex);
            } else {
                var obstacleSpritePos = this.spritePos[obstacleType.type];
                this.obstacles.push(new Obstacle(this.canvasCtx, obstacleType,
                    obstacleSpritePos, this.dimensions,
                    this.gapCoefficient, currentSpeed, obstacleType.width));

                this.obstacleHistory.unshift(obstacleType.type);

                var triggerSpeed = 12;
                if (this.rootcls.gameMode === Runner.mode.easy){
                    triggerSpeed = 10.4
                }
                if (currentSpeed > triggerSpeed){
                    var random = getRandomNum(0, 50 * (Runner.difficultyCoefficent.easy / CURRENT_DIFF_COEFFICIENT));
                    if (random <= currentSpeed){
                        this.thunder.start(currentSpeed);
                    }
                }
            }
        },


        /**
         * Reset the horizon layer.
         * Remove existing obstacles and reposition the horizon line.
         */
        reset: function () {
            this.obstacles = [];
            this.horizonLine.reset();
            this.thunder.end();
        },

        /**
         * Update the canvas width and scaling.
         * @param {number} width Canvas width.
         * @param {number} height Canvas height.
         */
        resize: function (width, height) {
            this.canvas.width = width;
            this.canvas.height = height;
        },
    };
})();


function onDocumentLoad() {
    new Runner('.interstitial-wrapper');

    // window location query
    locationQuery = window.location.search.replace(/^\?/, '').split('&').reduce(function (acc, part) {
        var parts = part.split('=')
        var obj = {}
        obj[parts[0]] = decodeURIComponent(parts[1])
        return Object.assign({}, acc, obj)
    }, {});

    // override nav icon click
    document.addEventListener('click', function (event) {
        if (event.target.tagName === 'A' && event.target.id.indexOf('nav') === 0) {
            if (event.target.className.indexOf('disabled') > 0) {
                event.preventDefault()
            }
        }
    });

    // web iframe style
    if (locationQuery.ref === 'web' && !locationQuery.mobile) {
        document.body.className += ' iframe'
    }

    // init nav icon hrefs
    var repo = 'https://github.com/lihkg/lihkg-running-dog';
    if (locationQuery.ref === 'app') {
        document.querySelector('#navClose').href = 'runningdog://quit'
        document.querySelector('#navGithub').href = 'runningdog://github?' + repo
        document.querySelector('#navScreenshot').classList.add('app')
        document.querySelector('#toggleShowName').classList.add('app')
        document.querySelector('#difficultyButton').classList.add('app')
    } else {
        if (locationQuery.ref === 'web' && !locationQuery.mobile) {
            document.querySelector('#navScreenshot').classList.add('web')
            document.querySelector('#toggleShowName').classList.add('web')
            document.querySelector('#difficultyButton').classList.add('web')
        }
        document.querySelector('#navClose').onclick = function (event) {
            event.preventDefault()
            window.parent.postMessage('onGameClose', '*')
        };
        document.querySelector('#navGithub').href = repo
    }
    document.querySelector('#navScreenshot').onclick = function (event) {
        var score = event.target.getAttribute('data-score');
        var mode = event.target.getAttribute('data-mode');
        window.ga('send', 'event', 'share_result_'+mode, locationQuery.username || '(GUEST)', score)
    };

    document.querySelector('#difficultyButton').onclick = function (event) {
        location.reload(false);
    };
}

document.addEventListener('DOMContentLoaded', onDocumentLoad);
