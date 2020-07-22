/*legend for level plans:
  # are clouds
  + are lightning
  @ is player start point
  O chars are cookies
  = are horizontal bouncy lightning
  | vertical bouncy lightning
  m monster that behaves like horizontal lightning*/
  //Purpose of game: collect all cookies without falling/getting electrocuted

let simpleLevelPlan = `
......................
..#................#..
..#..............=.#..
..#.........o.o....#..
..#.@......#####...#..
..#####............#..
......#++++++++++++#..
......##############..
......................`;
//classes to implement here:
//cookies: actor
//player:actor
//lightning, static and horizontal moving: actor
//level to contain actors and allow touching/colliding


//Level and building them

class Vec{
  constructor(x,y){
    this.x = x;
    this.y = y;
  }

  plus(other){
    return new Vec(this.x + other.x, this.y + other.y);
  }

  times(factor){
    return new Vec(factor*this.x, factor*this.y);
  }
}
class Level{
  constructor(plan){
    //trim() removes whitespace, split(\n) gives us each row to map
    //(l => [...l]) spreads the line into an array.rows is an array of arrays.
    let rows = plan.trim().split('\n').map(l => [...l]);
    this.height = rows.length;
    this.width = rows[0].length;
    this.startActors = [];//we'll add actors below based on map

    this.rows = rows.map((row,y) =>{
      return row.map((ch,x) =>{
        let type = levelChars[ch];
        if(typeof type == 'string') return type;
        this.startActors.push(type.create(new Vec(x,y),ch));//creates actor list
        return 'empty';
      });
    });
  }//end constructor
}
Level.prototype.touches = function(pos, size, type){

  var xStart = Math.floor(pos.x);
  var xEnd = Math.ceil(pos.x + size.x);
  var yStart = Math.floor(pos.y);
  var yEnd = Math.ceil(pos.y + size.y);
  for(var y = yStart; y < yEnd; y++){
    for(var x = xStart; x < xEnd; x++){
      let isOutside = x < 0 || x >= this.width || y >= this.height || y < 0;
      let here = isOutside ? 'wall' : this.rows[y][x];//? ternary operator, if x,y is outside assign here = 'wall'
      if(here == type){
        return true;
      }
    }
  }
  return false;
};

class State{
  constructor(level, actors, status, cookies, life){
    this.level = level;
    this.actors = actors;
    this.status = [status, cookies, life];
    //this.cookies = cookies;
    //this.life = life;
  }

  static start(level, startCookies, startLife){
    return new State(level, level.startActors, 'playing', startCookies, startLife);
  }

  get player(){
    return this.actors.find(a => a.type == 'player');
  }
}
State.prototype.update = function(time, keys){
  let actors = this.actors.map(actor => actor.update(time, this, keys));
  let newState = new State(this.level, actors, this.status[0], this.status[1], this.status[2]);

  if(newState.status[0] != 'playing'){
    return newState;
  }

  let player = newState.player;
  if(this.level.touches(player.pos, player.size, 'lightning')){
    return new State(this.level, actors, 'lost', this.status[1], this.status[2]);
  }

  for(let actor of actors){
    if(actor != player && overlap(actor, player)){
      newState = actor.collide(newState);
    }
  }//assumes this happens first before they touch the lightning for now.
  return newState;
};

function overlap(actor1, actor2){
    return ((actor1.pos.x + actor1.size.x > actor2.pos.x && actor1.pos.x < actor2.pos.x + actor2.size.x)
    && (actor1.pos.y + actor1.size.y > actor2.pos.y && actor1.pos.y < actor2.pos.y + actor2.size.y));
}
//Tracking keys for Player class

function trackKeys(keys){
  let down = Object.create(null);
  function track(event){
    if(keys.includes(event.key)){
      down[event.key] = event.type == 'keydown';
      event.preventDefault();
    }
  }
  window.addEventListener('keydown', track);
  window.addEventListener('keyup', track);
  return down;
}

const arrowKeys = trackKeys(['ArrowLeft', 'ArrowRight', 'ArrowUp']);

//Actor classes in the levels that are part of actor list

const playerXSpeed = 9;
const gravity = 25;
const jumpSpeed = 16;
class Player{
  constructor(pos, speed){
    this.pos = pos;
    this.speed = speed;
  }

  get type(){
    return 'player';
  }

  static create(pos){
    return new Player(pos.plus(new Vec(0, -0.5)), new Vec(0,0));
  }
}
Player.prototype.size = new Vec(0.8, 1.0);
Player.prototype.update = function(time, state, keys){
  //check if player is touching a cloud
  let clouds = state.actors.filter(a => a.type == 'cloud');//array of clouds
  let touching = false;
  for(let i = 0; i < clouds.length; i++){
    if(overlap(clouds[i], this)){
      var myCloud = clouds[i];
      touching = true;
      break;
    }
  }//found out if touching a cloud

  let xSpeed = 0;
  if(keys.ArrowLeft){
    xSpeed -= playerXSpeed;
  }

  if(keys.ArrowRight){
    xSpeed += playerXSpeed;
  }

  if(touching){
    xSpeed += myCloud.speed.x;
  }

  let pos = this.pos;
  let movedX = pos.plus(new Vec(xSpeed*time, 0));
  if(!state.level.touches(movedX, this.size, 'wall')){
    pos = movedX;
  }

  let ySpeed = this.speed.y + time*gravity; //it's addition since larger y is lower on screen
  if(touching && this.pos.y == myCloud.pos.y){
    ySpeed = this.speed.y;
  }
  let movedY = pos.plus(new Vec(0, ySpeed*time));
  if(!state.level.touches(movedY, this.size, 'wall')){
    pos = movedY;
  } else if(keys.ArrowUp && ySpeed > 0){
    ySpeed = -jumpSpeed;
  } else {
    ySpeed = 0;
  }

  return new Player(pos, new Vec(xSpeed, ySpeed));
};

class Cloud{
  constructor(pos, speed){
    this.pos = pos;
    this.speed = speed;
  }

  get type(){return 'cloud'}

  static create(pos, ch){
    switch(ch){
      case '>': return new Cloud(pos, new Vec(5,0));
      case '<': return new Cloud(pos, new Vec(-5,0));
    }

  }
}
Cloud.prototype.size = new Vec(1,1);//state.level.width
Cloud.prototype.update = function(time, state){
  let newPos = this.pos.plus(this.speed.times(time));
  if(newPos.x > state.level.width){//right cloud falls off right edge
    return new Cloud(new Vec(0, this.pos.y), this.speed);
  } else if (newPos.x < 0){//left cloud falls off left edge
    return new Cloud(new Vec(state.level.width, this.pos.y), this.speed);
  } else{
    return new Cloud(newPos, this.speed);//cloud's doing ok
  }
};
Cloud.prototype.collide = function(state){
  let player = state.actors.filter(a => a.type == 'player')[0];
  let cloud = state.actors.filter(a => a == this)[0];
  let filtered = state.actors.filter(a => a.type != 'player');//remove old player
  if(player.pos.y < cloud.pos.y){
    player.speed.y = 0;//doesn't fall through
  }
  console.log(`playerX: ${player.speed.x}: cloud speed: ${cloud.speed.x}`);
  filtered.push(player);//put new player in
  return new State(state.level, filtered, state.status[0], state.status[1], state.status[2]);
};
class Lightning{
  constructor(pos, speed){
    this.pos = pos;
    this.speed = speed;
  }

  get type(){return 'lightning'}

  static create(pos, ch){
    switch(ch){
      case '|': return new Lightning(pos, new Vec(0,2));
      case '=': return new Lightning(pos, new Vec(2,0));
      case '+': return new Lightning(pos, new Vec(0,0));
    }
  }
}
Lightning.prototype.size = new Vec(1,1);
Lightning.prototype.update = function(time, state){
  let newPos = this.pos.plus(this.speed.times(time));
  if(!state.level.touches(newPos, this.size, 'wall')){//lightning didn't hit anything
    return new Lightning(newPos, this.speed);
  } else {
    return new Lightning(this.pos, this.speed.times(-1));
  }//bouncy lightning
};
Lightning.prototype.collide = function(state){
  return new State(state.level, state.actors, 'lost', state.status[1], state.status[2]);
};

class Monster{
  constructor(pos, speed){
    this.pos = pos;
    this.speed = speed;
  }

  get type(){return 'monster';}

  static create(pos){
    return new Monster(pos.plus(new Vec(0,-1)), new Vec(1,0));
  }
}
Monster.prototype.size = new Vec(1,1.5);
Monster.prototype.update = function(time, state){
  let newPos = this.pos.plus(this.speed.times(time));
  if(!state.level.touches(newPos, this.size, 'wall')){
    return new Monster(newPos, this.speed);
  } else{
    return new Monster(this.pos, this.speed.times(-1));
  }
};
Monster.prototype.collide = function(state){
  let monster = state.actors.filter(a => a == this)[0];
  let player = state.actors.filter(a => a.type == 'player')[0];
  let newLife = state.status[2];
  let newSpeed = new Vec(player.speed.x, (-1*player.speed.y));
  player.speed = newSpeed;

  if(player.pos.y < monster.pos.y){//lower y is closer to "top"
    let filtered = state.actors.filter(a => a != this);//remove Monster
    newLife += 1;
    return new State(state.level, filtered, state.status[0], state.status[1], newLife);
  } else{
    newLife -=1;
    return new State(state.level, state.actors, 'lost', state.status[1], newLife);
  }
};

const wobbleSpeed = 6, wobbleDist = .1;
class Cookie{
  constructor(pos, basePos, wobble){
    this.pos = pos;
    this.basePos = basePos;
    this.wobble = wobble;
  }

  get type(){return 'cookie';}

  static create(pos){
    let basePos = pos.plus(new Vec(.2, 0.1));
    return new Cookie(basePos, basePos, Math.random()*Math.PI*2);
  }
}
Cookie.prototype.size = new Vec(0.7, 0.7);
Cookie.prototype.update = function(time){
  let wobble = this.wobble + time*wobbleSpeed;
  let wobblePos = Math.sin(wobble)*wobbleDist;
  return new Cookie(this.basePos.plus(new Vec(0, wobblePos)), this.basePos, wobble);
};

Cookie.prototype.collide = function(state){
  let newCookies = state.status[1] + 1;
  let newLife = state.status[2];
  let filtered = state.actors.filter(a => a != this);
  if(newCookies == 2){
    newLife += 1;
    newCookies = 0;
  }
  return new State(state.level, filtered, state.status[0], newCookies, newLife);
};

class WinSpot{
  constructor(pos){
    this.pos = pos;
  }

  get type(){ return 'winSpot';}

  static create(pos){
    return new WinSpot(pos);
  }
}
WinSpot.prototype.size = new Vec(2,2);
WinSpot.prototype.update = function(time){
  return new WinSpot(this.pos);
};
WinSpot.prototype.collide = function(state){
  return new State(state.level, state.actors, 'won', state.status[1], state.status[2]);
};

const levelChars = {
  '.': 'empty',
  '#': 'wall',
  '+': Lightning,
  '|': Lightning,
  '=': Lightning,
  'm': Monster,
  '@': Player,
  'o': Cookie,
  '<': Cloud,
  '>': Cloud,
  'x': WinSpot
}
//Displaying level and actors

function elt(name, attrs, ...children){
  let dom = document.createElement(name);
  for(let attr of Object.keys(attrs)){
    dom.setAttribute(attr, attrs[attr])
  }
  for(let child of children){
    dom.appendChild(child);
  }
  return dom;
}

var scale = 20;
class DOMDisplay{
  constructor(parent, level){
    this.dom = elt('div', {class: 'game'}, drawGrid(level));
    this.actorLayer = null;
    parent.appendChild(this.dom);
  }
  clear(){this.dom.remove();}
}
DOMDisplay.prototype.syncState = function(state){
  if(this.actorLayer){
    this.actorLayer.remove();//removes old actor layer
  }
  this.actorLayer = drawActors(state.actors);
  this.dom.appendChild(this.actorLayer);
  this.dom.className = `game ${state.status[0]}`;
  this.scrollPlayerIntoView(state);
};
DOMDisplay.prototype.scrollPlayerIntoView = function(state){
  let width = this.dom.clientWidth;
  let height = this.dom.clientHeight;
  let margin = width/3;

  //the viewport
  let left = this.dom.scrollLeft, right = left + width;
  let top = this.dom.scrollTop, bottom = top + height;

  let player = state.player;
  let center = player.pos.plus(player.size.times(0.5)).times(scale);

  if(center.x < left + margin){
    this.dom.scrollLeft = center.x - margin;
  } else if (center.x > right - margin){
    this.dom.scrollLeft = center.x + margin - width;
  }//scrolls left or right to keep player near center

  if(center.y < top + margin){
    this.dom.scrollTop = center.y - margin;
  } else if(center.y > bottom - margin){
    this.dom.scrollTop = center.y + margin - height
  }
};

function drawGrid(level){
  return elt('table',{
    class: 'background',
    style: `width: ${level.width*scale}px`
  }, ...level.rows.map(row => elt('tr', {style: `height: ${scale}px`}, ...row.map(type => elt('td', {class: type})))));
}//background is a <table> element with rows.
 //spread(triple dot) operator is used to pass arrays of child nodes to elt as separate arguments

 function drawActors(actors){
   return elt('div', {}, ...actors.map(actor => {
     let rect = elt('div', {class: `actor ${actor.type}`});
     rect.style.width = `${actor.size.x*scale}px`;
     rect.style.height = `${actor.size.y*scale}px`;
     rect.style.left = `${actor.pos.x*scale}px`;
     rect.style.top = `${actor.pos.y*scale}px`;
     return rect;
   }));
 }

//Animate the game
function runAnimation(frameFunc){
  let lastTime = null;
  function frame(time){
    if(lastTime != null){
      let timeStep = Math.min(time - lastTime, 100)/1000;
      if(frameFunc(timeStep) === false) return;
    }
    lastTime = time;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function runLevel(level, Display, cookies, life){
  let display = new Display(document.body, level);
  let state = State.start(level, cookies, life);
  let ending = 1;
  return new Promise(resolve => {
    runAnimation(time => {
      state = state.update(time, arrowKeys);
      display.syncState(state);
      if(state.status[0] =='playing'){
        return true;
      } else if(ending> 0){//you're transitioning
        ending -= time;
        return true;
      } else{//clean board to restart
        display.clear();
        resolve(state.status);
        return false;
      }
    });
  });
}

async function runGame(plans, Display){
  var startLife = 10;
  var startCookie = 0;
  for(let level = 0; level < plans.length;){
    let status = await runLevel(new Level(plans[level]), Display ,startCookie, startLife);
    if(status[0] == 'won'){
      startLife = status[2];
      startCookie = status[1];
      level++;
    }
    if(status[0] =='lost'){
      startLife = status[2] - 1;
      startCookie = status[1];
      console.log(`Lives left: ${startLife}`);
    }
  }
  console.log("you've won... for now");
}
