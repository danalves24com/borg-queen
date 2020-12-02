const WebSocket = require('ws');
const express = require('express')
const bodyParser = require('body-parser')
const path = require('path')
const app = express();
const cors = require('cors');

//app.use(express.static(path.join(__dirname, '/build'))) //to host a build website
app.use(bodyParser.json({ limit: "50mb" }))
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true, parameterLimit: 150000 }))

app.use(cors())
app.get("/stat", (req, res) => {
    res.status(200).send(`server is running`)
})



const server = new WebSocket.Server({
  port: 8080
});
let sockets = [],
    outputs = [],
    dataToBeReintegrated = [],
    transferRoster = [],
    
    nodes = [];

function reUpload(data, originalNode) {
    if(nodes.length < 2) {
        console.log("no nodes in system, putting data into cache")
        dataToBeReintegrated.push(data)
    }
    else {
        nodes.forEach(node => {
            var nodeStatus = (node[2] == "proc" && node[4]<2 && node[1] != originalNode),
            selected = false
            if(!selected) {
                if(nodeStatus) {
                    transferRoster.push(`${originalNode}>`+node[1])
                    console.log(transferRoster)
                    node[2] = "reTake#"+data
                    node[0].send(node[2])
                }
            }
        })
    }
}

var reintegrateData = (data, node) => {
    data=data.replace("[", "").replace("]", "").replace("dyingBreath:", "")
    data = data.split(", ")
    for(var dat in data) {
        dat=data[dat];
        reUpload(dat, node[1])

    }
    console.log(data)
}

server.on('connection', function(socket) {
    console.log("new node connected")
    var id = Math.random(),
    socketDisc = [socket, id, "proc", "res", 0];
    sockets.push(socket);
    nodes.push(socketDisc)
    socket.send("we_are_the_borg")

  
  socket.on('message', function(msg) {
      if(msg.substring(0, 12).includes("dyingBreath:")) {
        console.log("node died with last words")
        reintegrateData(msg, socketDisc)
        //console.log(msg)
      }
      else {
        //outputs.push(msg)
        //console.log(msg)
        nodes.forEach(node => {
            if (node[1] == id) {
                node[3] = msg
                node[2] = "proc"
            }
        })
      }

  });

  
  socket.on('close', function() {
    console.log("a node has disconnected")
    sockets = sockets.filter(s => s !== socket);
    nodes = nodes.filter(s => s[0] !== socket);
  });

});






    app.post("/data/upload", (req, res) => {
        var nodesSelected = 0;
        var holdingNodeIDs = []
        nodes.forEach( node => {
            if(nodesSelected!=2) {
                if(node[2] == "proc" && node[4]<2) {
                    node[2] = "hold#"+req.body.data;
                    nodesSelected+=1;
                    node[0].send(node[2]);
                    holdingNodeIDs.push(node[1]);
                }
            }
        })
        res.send(holdingNodeIDs)
    })
    app.post("/data/query", (req, res) => {
        var done = false,
        id = ""
        for(var transfer in transferRoster) {
            transfer = transferRoster[transfer].split(">") 
            if(transfer[0].includes(req.body.node)) {                
                id=transfer[1]
                done=true;
            }
        }
        if(!done) {
            id=req.body.node
        }
            nodes.forEach(node => {
                if(node[1] == id) {
                    node[0].send("query#"+req.body.key);
                    res.send(`/${node[1]}/data`)
                }
            })
        

    })

    app.post("/assign", (req, res) => {
        let freeSockets = 0,
        done = false;
        nodes.forEach( node => {
            if(!done) {
                if(node[2] == "proc") {
                    node[2] = req.body.proc;
                    node[0].send(req.body.proc)
                    res.send("node: " + node[1])     
                    done = true            
               }  
               else {
                   console.log(node[1], 'busy')
               }    
            }
            else {

            }
        })        
        console.log("done")
    })
    app.get("/:node/data", (req, res) => {
        nodes.forEach(node => {
            if(node[1] == req.params.node) {
                var send = node[3] + ""
                node[3] = "res"
                res.send(send)
            }
        })
    })
    //server log
    app.listen(8000, () => console.log("server is listening on port 8000, happy coding"))