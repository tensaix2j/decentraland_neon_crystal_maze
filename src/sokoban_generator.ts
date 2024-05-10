


//--------------------------------
//create a 2D Array
function Array2d(xSize, ySize, content) {
    var NodeGrid = new Array(xSize);
    for (var i = 0; i < xSize; i++) {
        NodeGrid[i] = new Array(ySize);
        for (var j = 0; j < ySize; j++) {
            NodeGrid[i][j] = content;
        }
    }
    return NodeGrid;
}



//--------------------------------
//return a random integer between min (included) and max (excluded)
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}



//--------------------------------
//add to sorted array via binary search
function addToSortedArray(array, element, compareFunction) {
    var index = binarySearch(array, element, compareFunction);
    if (index < 0) { index = -index - 1; }
    array.splice(index, 0, element);
}



//--------------------------------
//binary search in sorted array 
function binarySearch(array, element, compareFunction) {
    var m = 0;
    var n = array.length - 1;
    while (m <= n) {
        var k = (n + m) >> 1;
        var cmp = compareFunction(element, array[k]);
        if (cmp > 0) {
            m = k + 1;
        } else if (cmp < 0) {
            n = k - 1;
        } else {
            return k;
        }
    }
    return -m - 1;
}




//--------------------------------
function fComparer(element1, element2) {
    return element1.f - element2.f;
}



//--------------------------------
//check if a point is in the boundaries of a 2D-array
function checkBoundaries(arr2D, x, y) {
    if (x >= 0 && x < arr2D.length && y >= 0 && y < arr2D[0].length) {
        return true;
    }
    return false;
}






//--------------------------------
//generates the paths between boxes and buttons in a level by removing walls

function generatePaths(lvl) {
    var steps = 0;
    //create ghostBoxes for solving
    var ghostBoxes = copyBoxes(lvl, false);
    //push the ghostBoxes towards the buttons
    while (lvl.solveCounter > 0) {
        //calculate the paths from all boxes to their buttons
        var boxPaths = CalcualteBoxPaths(lvl, ghostBoxes);

        //calculate the player paths to all boxes and choose the lowest cost path
        var playerPaths = CalcualtePlayerPaths(lvl, ghostBoxes, boxPaths);
        var bestPath = playerPaths[1];
        var playerPath = playerPaths[0][bestPath][0];
        var boxPath = boxPaths[bestPath][0];

        //remove all walls on the player's path
        for (var i = 0; i < playerPath.length; i++) {
            playerPath[i].wall = false;
            if (playerPath[i].occupied) {
                lvl.trash = true;

            }
        }
        //push the box into the solving direction
        var thisbox:Box = ghostBoxes[bestPath];
        var currentNode = boxPath[0];
        var diffX = currentNode.x - thisbox.x;
        var diffY = currentNode.y - thisbox.y;
        var stop = 0;

        //if the box-path is longer than 1, push until there is a turn
        if (boxPath.length > 1) {
            for (var i = 1; i < boxPath.length; i++) {
                var nextNode = boxPath[i];
                if (diffX == nextNode.x - currentNode.x && diffY == nextNode.y - currentNode.y) {
                    currentNode = nextNode;
                } else {
                    stop = i - 1;
                    break;
                }
            }
        }
        //remove all walls on the box's path
        for (var i = 0; i <= stop; i++) {
            boxPath[i].wall = false;
        }
        //set new player and box positions
        lvl.nodes[thisbox.x][thisbox.y].occupied = false;
        thisbox.setPosition(boxPath[stop].x, boxPath[stop].y)
        lvl.nodes[thisbox.x][thisbox.y].occupied = true;
        lvl.setPlayerPos(thisbox.x - diffX, thisbox.y - diffY)

        //check if the moved box is on the button
        if (thisbox.x == thisbox.solveButton.x && thisbox.y == thisbox.solveButton.y) {
            thisbox.placed = true;
            lvl.solveCounter--;
            ghostBoxes.splice(bestPath, 1);
        }
        steps++;
        if (steps > 4000) {
            lvl.trash = true;
            break;
        }
    }
    //reset player position
    lvl.setPlayerPos(lvl.playerstartX, lvl.playerstartY);
}




//--------------------------------
function copyBoxes(lvl, used) {
    var newBoxes:any = [];
    for (var i = 0; i < lvl.boxes.length; i++) {
        newBoxes.push(new Box(lvl.boxes[i].x, lvl.boxes[i].y, lvl.boxes[i].solveButton));
        lvl.nodes[lvl.boxes[i].x][lvl.boxes[i].y].occupied = true;
        lvl.nodes[lvl.boxes[i].x][lvl.boxes[i].y].used = used;
    }
    return newBoxes;
}


//--------------------------------
//calculate all boxpaths and return them in an array
function CalcualteBoxPaths(lvl, ghostBoxes) {
    var boxPaths:any[] = [];
    for (var i = 0; i < ghostBoxes.length; i++) {
        var thisbox = ghostBoxes[i];
        lvl.nodes[thisbox.x][thisbox.y].occupied = false;
        var solver = new Pathfinder(lvl, thisbox.x, thisbox.y, thisbox.solveButton.x, thisbox.solveButton.y)
        boxPaths.push(solver.returnPath(true));
        lvl.nodes[thisbox.x][thisbox.y].occupied = true;
    }
    return boxPaths;
}


//--------------------------------
//return all player paths and the index of the lowest cost one
function CalcualtePlayerPaths(lvl, ghostBoxes, boxPaths):any[] {
    
    var playerPaths:any[] = [];
    var bestPath = -1;
    var lowestCost = 100000000;
    for (var i = 0; i < ghostBoxes.length; i++) {
        var newX = ghostBoxes[i].x;
        var newY = ghostBoxes[i].y;
        if (boxPaths[i][0][0].x == ghostBoxes[i].x + 1) {
            newX -= 1;
        } else if (boxPaths[i][0][0].x == ghostBoxes[i].x - 1) {
            newX += 1;
        } else if (boxPaths[i][0][0].y == ghostBoxes[i].y + 1) {
            newY -= 1;
        } else {
            newY += 1;
        }
        var solver = new Pathfinder(lvl, lvl.playerX, lvl.playerY, newX, newY);
        playerPaths.push(solver.returnPath(false));
        if (playerPaths[i][1] < lowestCost) {
            lowestCost = playerPaths[i][1];
            bestPath = i;
        }
    }
    return ([playerPaths, bestPath]);

}




//--------------------------------
export class SokobanGenerator {
    
    public xSize;
    public ySize;
    public buttons;
    public boxes;
    public ghostboxes;
    public blockSize;
    public solveCounter;
    public savedPositions;
    public trash;
    public nodes;
    public playerstartX;
    public playerstartY;
    public playerX;
    public playerY;
    public allowedSpots;
    public boxMap;
    public buttonMap;
    public doorMap;

    //----------------------
    constructor(xSize, ySize, NumBoxes) {

        this.xSize = xSize;
        this.ySize = ySize;
        this.buttons = [];
        this.boxes = [];
        this.ghostboxes = [];
        this.blockSize = 1;
        this.solveCounter = NumBoxes;
        this.savedPositions = [];
        this.trash = false;
        this.boxMap = {};
        this.buttonMap = {};
        this.doorMap = {};

        //initialize nodes for pathfinding
        this.nodes = Array2d(xSize, ySize, null);
        for (var i = 0; i < this.nodes.length; i++) {
            for (var j = 0; j < this.nodes[0].length; j++) {
                this.nodes[i][j] = new Node(i, j);
            }
        }
        //randomly place boxes and buttons
        this.defineAllowedSpots();
        this.placeObjects(NumBoxes);
        this.rip(randomInt(-2, 5));
        generatePaths( this );
        this.createDoors();

    }

    
    //---------------------
    //check if a spot is surrounded by walls
    surrounded( x, y) {
        for (var i = x - 1; i <= x + 1; i++) {
            for (var j = y - 1; j <= y + 1; j++) {
                if (checkBoundaries(this.nodes, i, j) && !this.nodes[i][j].wall) {
                    return false;
                }
            }
        }
        return true;
    }

    //---------
    printMap( arr  ) {

        for ( let i = 0 ; i < arr.length ; i++ ) {
            let line = "";
            for ( let j = 0 ; j < arr[i].length ; j++ ) {

                let item = ".|";

                if ( this.boxMap[j+","+i] && this.buttonMap[j+","+i] ) {
                    item = "K|"
                } else if ( this.boxMap[j+","+i] ) {
                    item = "T|"

                } else if (  this.buttonMap[j+","+i] ) {
                    item = "O|"
                
                } else if ( arr[j][i].wall == true ) {

                    if ( this.surrounded(j,i) == false ) {
                        item = "W|"
                    } else {
                        item = "_|"
                    }

                } 
                if ( this.playerX == j && this.playerY == i ) {
                    item = "@|"
                }

                line += item
            }
            console.log( line + i );
        }
        let line = "";
        for ( let j = 0 ; j < arr[0].length ; j++ ) {
            line += "0123456789ABCDEF"[j] + "|" 
        }
        console.log( line );

    }

    //--------
    createDoors( ) {
        
        let doorCreated = 0;
        for ( let j = 0 ; j < 3 ; j++ ) {
            let col = (( this.xSize / 2 ) >> 0 ) + j - 1;
            for ( let i = 0; i < this.ySize / 2 ; i++ ) {
                if (  this.nodes[col][i].wall == true && this.surrounded(col,i) == false ) {
                    if ( this.nodes[col][i+1].wall == false && this.buttonMap[col+","+(i+1)]== null ) {
                        this.doorMap[ col + "," + i ] = 1;
                        doorCreated = 1;
                    }
                    break;
                }
            }
            if ( doorCreated == 1) {
                break;
            }
        }

        doorCreated = 0;
        for ( let j = 0 ; j < 3 ; j++ ) {
            let col = (( this.xSize / 2 ) >> 0 ) + j - 1;
            for ( let i = this.ySize -1 ; i>= this.ySize / 2 ; i-- ) {
                if (  this.nodes[col][i].wall == true && this.surrounded(col,i) == false ) {
                    if ( this.nodes[col][i-1].wall == false && this.buttonMap[col+","+(i-1)]== null ) {
                        this.doorMap[ col + "," + i ] = 2;
                        doorCreated = 1;
                    }
                    break;
                }
            }
            if ( doorCreated == 1) {
                break;
            }
        }


        doorCreated = 0;
        for ( let i = 0 ; i < 3 ; i++ ) {
            let row = (( this.ySize / 2 ) >> 0 ) + i - 1;
            for ( let j = 0; j < this.xSize / 2 ; j++ ) {
                if (  this.nodes[j][row].wall == true && this.surrounded(j,row) == false ) {
                    if ( this.nodes[j+1][row].wall == false && this.buttonMap[(j+1)+","+row]== null ) {
                        this.doorMap[ j + "," + row ] = 3;
                        doorCreated = 1;
                    }
                    break;
                }
            }
            if ( doorCreated == 1) {
                break;
            }
        }

        doorCreated = 0;
        for ( let i = 0 ; i < 3 ; i++ ) {
            let row = (( this.ySize / 2 ) >> 0 ) + i - 1;
            for ( let j = this.xSize - 1; j >= this.xSize / 2 ; j-- ) {
                if (  this.nodes[j][row].wall == true && this.surrounded(j,row) == false ) {
                    if ( this.nodes[j-1][row].wall == false && this.buttonMap[(j-1)+","+row]== null ) {
                        this.doorMap[ j + "," + row ] = 4;
                        doorCreated = 1;
                    }
                    break;
                }
            }
            if ( doorCreated == 1) {
                break;
            }
        }
    }   


    //----------------------
    placeObjects(numBoxes) {


        //place buttons
        for (var i = 0; i < numBoxes; i++) {
            var pos = this.randomSpot();
            if (pos != null) {
                this.buttons.push(new Button(pos[0], pos[1]))
                this.buttonMap[ pos[0] + "," + pos[1] ] = 1;
            }
        }
        //place boxes
        for (var i = 0; i < numBoxes; i++) {
            var pos = this.randomSpot();
            if (pos != null) {
                this.boxes.push(new Box(pos[0], pos[1], this.buttons[i]))
                this.boxMap[ pos[0] + "," + pos[1] ] = 1;
                this.nodes[pos[0]][pos[1]].hasBox = true;
            }
        }
        //place player
        var pos = this.randomSpot();
        if (pos == null) {
            pos = [this.buttons[0].x, this.buttons[0].y];
        }
        this.setPlayerPos(pos[0], pos[1]);
        this.playerstartX = this.playerX;
        this.playerstartY = this.playerY;
    }


    //----------------------
    //write all nodes, where placement is allowed into a list
    defineAllowedSpots() {
        this.allowedSpots = [];
        for (var i = 2; i < this.nodes.length - 2; i++) {
            for (var j = 2; j < this.nodes[0].length - 2; j++) {
                this.allowedSpots.push(this.nodes[i][j]);
            }
        }
    }


    //----------------------
    //return a random unoccupied spot and remove the wall
    randomSpot() {
        if (this.allowedSpots.length != 0) {
            var rand = randomInt(0, this.allowedSpots.length);
            var x = this.allowedSpots[rand].x;
            var y = this.allowedSpots[rand].y;
            this.allowedSpots.splice(rand, 1);
            this.nodes[x][y].wall = false;
            if (this.blockaded(x, y)) {
                return this.randomSpot();
            } else {
                return [x, y];
            }
        } else {
            return null;
        }
    }


    //----------------------
    //randomly remove walls from the level
    rip(amount) {
        for (var i = 0; i < amount; i++) {
            if (this.allowedSpots.length != 0) {
                this.randomSpot();
            }
        }
    }


    //----------------------
    setPlayerPos(X, Y) {
        this.playerX = X;
        this.playerY = Y;
    }



    //----------------------
    //check if a spot is blockaded by boxes
    blockaded(X, Y) {
        if (this.nodes[X + 1][Y].hasBox) {
            if ((this.nodes[X + 1][Y + 1].hasBox && this.nodes[X][Y + 1].hasBox) || (this.nodes[X + 1][Y - 1].hasBox && this.nodes[X][Y - 1].hasBox)) {
                return true;
            }
        }
        if (this.nodes[X - 1][Y].hasBox) {
            if ((this.nodes[X - 1][Y - 1].hasBox && this.nodes[X][Y - 1].hasBox) || (this.nodes[X - 1][Y + 1].hasBox && this.nodes[X][Y + 1].hasBox)) {
                return true;
            }
        }
        return false;
    }
}





//--------------------------------
class Box {

    public x;
    public y;
    public placed;
    public solveButton;

    constructor(X, Y, button) {
        this.x = X;
        this.y = Y;
        this.placed = false;
        this.solveButton = button;
    }

    setPosition(X, Y) {
        this.x = X;
        this.y = Y;
    }

    placeExactly(X, Y) {
        this.x = X;
        this.y = Y;
    }
}





//--------------------------------
class Button {

    public x;
    public y;

    constructor(X, Y) {
        this.x = X;
        this.y = Y;
    }
}





//--------------------------------
// the idea behind this pathfinding algorithm is to traverse the least amount of walls
// additionally the player will always take the longest available free path when choosing a box

const wallCost = 100; //the cost for traversing a wall
var pathCost = 1; //the cost for traversing an unoccupied node
var playerPathCost = -1; //the player cost for traversing an unoccupied node
const boxCost = 10000; //the cost for traversing an occupied node

class Pathfinder {

    public level;
    public nodes;
    public startX;
    public startY;
    public endX;
    public endY;
    public open;
    public closed;

    constructor(Level, startX, startY, endX, endY) {
        this.level = Level;
        this.nodes = this.level.nodes;
        this.startX = startX;
        this.startY = startY;
        this.endX = endX;
        this.endY = endY;
        this.open = [];
        this.closed = [];
    }

    //return path and cost, cost of player-path and box-path can differ
    returnPath(isBox) {
        this.open.push(this.nodes[this.startX][this.startY]);
        while (this.open.length != 0) {
            var thisNode = this.open.shift();

            if (thisNode.x == this.endX && thisNode.y == this.endY) {
                this.open.push(thisNode);
                return this.sumPath(thisNode);
            } else {
                thisNode.closed = true;
                this.closed.push(thisNode);
                this.checkNeighbor(thisNode.x + 1, thisNode.y, thisNode, isBox);
                this.checkNeighbor(thisNode.x - 1, thisNode.y, thisNode, isBox);
                this.checkNeighbor(thisNode.x, thisNode.y + 1, thisNode, isBox);
                this.checkNeighbor(thisNode.x, thisNode.y - 1, thisNode, isBox);
            }
        }
        console.log("no path found");
        return this.sumPath(thisNode);
    }




    //recreate the path starting from the last node
    sumPath(endNode) {
        var path:any = [];
        var cost = endNode.cost;
        while (endNode.parent != null) {
            path.unshift(endNode);
            endNode = endNode.parent;
        }
        this.resetNodes();
        return [path, cost]
    }




    //check a neighboring node
    checkNeighbor(x, y, parent, isBox) {
        if (checkBoundaries(this.nodes, x, y)) {
            var thisNode = this.nodes[x][y];
            if (!thisNode.closed && !thisNode.checked) {
                thisNode.cost = this.calculateCost(thisNode, parent, isBox);
                thisNode.f = thisNode.cost + Math.abs(x - this.endX) + Math.abs(y - this.endY);
                thisNode.parent = parent;
                thisNode.checked = true;
                addToSortedArray(this.open, thisNode, fComparer);
            } else if (!thisNode.closed) {
                var cost = this.calculateCost(thisNode, parent, isBox);
                if (cost < thisNode.cost && thisNode.parent.parent != null) {
                    thisNode.cost = cost;
                    thisNode.f = thisNode.cost + Math.abs(x - this.endX) + Math.abs(y - this.endY);
                    thisNode.parent = parent;
                }
            }
        }
    }

    //calculate the cost for a  node 
    calculateCost(node, parent, isBox) {
        var tempCost = 0;
        if (node.occupied) {
            tempCost = parent.cost + boxCost;
        } else {
            if (isBox) {
                tempCost = (node.wall ? parent.cost + wallCost : parent.cost + pathCost);
            } else {
                tempCost = (node.wall ? parent.cost + wallCost : parent.cost + playerPathCost);
            }
        }
        // if the path is calculated for a box, the player path also has to be included
        // the player has to walk around the box when changing directions
        // there are always 2 ways to walk around the box for each of the 8 situations:
        if (isBox && parent.parent != null) {
            var cost1 = 0;
            var cost2 = 0;

            if (node.x - 1 == parent.x && node.x - 2 != parent.parent.x) {
                //case 1: node is right of parent
                if (node.y - 1 == parent.parent.y) {
                    //case 1.1: node is up right of parent.parent
                    cost1 = this.nodeCost(node.x - 2, node.y) + this.nodeCost(node.x - 2, node.y - 1)
                    cost2 = this.nodeCost(node.x, node.y - 1) + this.nodeCost(node.x, node.y + 1) + this.nodeCost(node.x - 1, node.y + 1) +
                        this.nodeCost(node.x - 2, node.y + 1) + this.nodeCost(node.x - 2, node.y);
                } else {
                    //case 1.2: node is down right of parent.parent
                    cost1 = this.nodeCost(node.x - 2, node.y) + this.nodeCost(node.x - 2, node.y + 1)
                    cost2 = this.nodeCost(node.x, node.y - 1) + this.nodeCost(node.x, node.y + 1) + this.nodeCost(node.x - 1, node.y - 1) +
                        this.nodeCost(node.x - 2, node.y - 1) + this.nodeCost(node.x - 2, node.y);;
                }
            } else if (node.x + 1 == parent.x && node.x + 2 != parent.parent.x) {
                //case 2: node is left of parent
                if (node.y - 1 == parent.parent.y) {
                    //case 2.1: node is up left of parent.parent
                    cost1 = this.nodeCost(node.x + 2, node.y) + this.nodeCost(node.x + 2, node.y - 1);
                    cost2 = this.nodeCost(node.x, node.y - 1) + this.nodeCost(node.x, node.y + 1) + this.nodeCost(node.x + 1, node.y + 1) +
                        this.nodeCost(node.x + 2, node.y + 1) + this.nodeCost(node.x + 2, node.y);
                } else {
                    //case 2.2: node is down left of parent.parent
                    cost1 = this.nodeCost(node.x + 2, node.y) + this.nodeCost(node.x + 2, node.y + 1);
                    cost2 = this.nodeCost(node.x, node.y - 1) + this.nodeCost(node.x, node.y + 1) + this.nodeCost(node.x + 1, node.y - 1) +
                        this.nodeCost(node.x + 2, node.y - 1) + this.nodeCost(node.x + 2, node.y);;
                }
            } else if (node.y - 1 == parent.y && node.y - 2 != parent.parent.y) {
                //case 3: node is above parent
                if (node.x - 1 == parent.parent.x) {
                    //case 3.1: node is right up of parent.parent  
                    var cost1 = this.nodeCost(node.x, node.y - 2) + this.nodeCost(node.x - 1, node.y - 2);
                    var cost2 = this.nodeCost(node.x - 1, node.y) + this.nodeCost(node.x + 1, node.y) + this.nodeCost(node.x + 1, node.y - 1) +
                        this.nodeCost(node.x + 1, node.y - 2) + this.nodeCost(node.x, node.y - 2);
                } else {
                    //case 3.2: node is left up of parent.parent  
                    var cost1 = this.nodeCost(node.x, node.y - 2) + this.nodeCost(node.x + 1, node.y - 2);
                    var cost2 = this.nodeCost(node.x - 1, node.y) + this.nodeCost(node.x + 1, node.y) + this.nodeCost(node.x - 1, node.y - 1) +
                        this.nodeCost(node.x - 1, node.y - 2) + this.nodeCost(node.x, node.y - 2);;
                }
            } else if (node.y + 1 == parent.y && node.y + 2 != parent.parent.y) {
                //case 4: node is under parent
                if (node.x - 1 == parent.parent.x) {
                    //case 4.1: node is right down of parent.parent
                    var cost1 = this.nodeCost(node.x, node.y + 2) + this.nodeCost(node.x - 1, node.y + 2);
                    var cost2 = this.nodeCost(node.x - 1, node.y) + this.nodeCost(node.x + 1, node.y) + this.nodeCost(node.x + 1, node.y + 1) +
                        this.nodeCost(node.x + 1, node.y + 2) + this.nodeCost(node.x, node.y + 2);
                } else {
                    //case 4.2: node is left down of parent.parent
                    var cost1 = this.nodeCost(node.x, node.y + 2) + this.nodeCost(node.x + 1, node.y + 2);
                    var cost2 = this.nodeCost(node.x - 1, node.y) + this.nodeCost(node.x + 1, node.y) + this.nodeCost(node.x - 1, node.y + 1) +
                        this.nodeCost(node.x - 1, node.y + 2) + this.nodeCost(node.x, node.y + 2);;
                }
            }
            tempCost += (cost1 < cost2 ? cost1 : cost2);
        } else if (isBox) {
            if (node.x - 1 == parent.x) {
                tempCost += this.nodeCost(node.x - 2, node.y);
            } else if (node.x + 1 == parent.x) {
                tempCost += this.nodeCost(node.x + 2, node.y);
            } else if (node.y - 1 == parent.y) {
                tempCost += this.nodeCost(node.x, node.y - 2);
            } else if (node.y + 1 == parent.y) {
                tempCost += this.nodeCost(node.x, node.y + 2);
            }

        }

        //for optimizing prefer used nodes
        if (node.used) {
            tempCost -= 5;
        }
        return tempCost;
    }

    //calculate the cost of a position
    nodeCost(x, y) {
        if (checkBoundaries(this.nodes, x, y)) {
            var node = this.nodes[x][y];
            if (node.occupied) {
                return boxCost;
            } else {
                return (node.wall ? wallCost : playerPathCost);
            }
        } else {
            return boxCost;
        }
    }

    //reset the level's nodes for further pathfinding
    resetNodes() {
        this.open.forEach(function(node) {
            node.checked = false;
            node.closed = false;
            node.parent = null;
            node.cost = 0;
        })
        this.closed.forEach(function(node) {
            node.checked = false;
            node.closed = false;
            node.parent = null;
            node.cost = 0;
        })
    }
}




//--------------------------------
class Node {
    //initialize each node as an unoccupied wall

    public x;
    public y;
    public f;
    public cost;
    public closed;
    public checked;
    public wall;
    public occupied;
    public parent;
    public hasBox;
    public hasButton;
    public used;

    constructor(X, Y) {
        this.x = X;
        this.y = Y;
        this.f = 0; //path-cost-estimation
        this.cost = 0; //path-cost
        this.closed = false; //variable for pathfinding
        this.checked = false; //variable for pathfinding
        this.wall = true; //check if node has a wall
        this.occupied = false; //check if node is occupied(for pathfinding)
        this.parent = null; //node parent for pathfinding
        this.hasBox = false; //check if node has a box
        this.hasButton = false;
        this.used = false; //variable for optimizing
    }
}


