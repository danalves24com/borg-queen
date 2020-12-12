const WebSocket = require('ws');
const express = require('express')
const bodyParser = require('body-parser')
const path = require('path')
const app = express();
const { v4: uuidv4 } = require('uuid');
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
            var nodeStatus = (node[2] == "proc" && node[4]<20 && node[1] != originalNode),
            selected = false
            if(!selected) {
                if(nodeStatus) {                    
                    var logged = false;
                    for(var t in transferRoster) {                    
                        var transfer = transferRoster[t].split(">")

                        if(transfer[1].includes(originalNode)) {
                            transferRoster[t] = transfer[0] + ">" + node[1]
                            logged = true
                        }
                        else {

                        }
                    }
                    if(!logged) {
                        transferRoster.push(`${originalNode}>`+node[1])
                    }
                    else {
                        
                    }
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
    var id = uuidv4(),
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
    console.log(nodes)
    sockets = sockets.filter(s => s !== socket);
    nodes = nodes.filter(s => s[0] !== socket);
    console.log(nodes)
  });

});



    app.post("/node-transfer", (req, res) => {
        var orignalNode = req.body.src,
        destonationNode = req.body.trg,
        logged = false;
        for(var t in transferRoster) {                    
            if(!logged) {
                var transfer = transferRoster[t].split(">")

                if(transfer[1].includes(orignalNode)) {
                    transferRoster[t] = transfer[0] + ">" + destonationNode
                    logged = true
                } 
                else if(transfer[0].includes(orignalNode)) {
                    transferRoster[t] = transfer[0] + ">" + destonationNode
                    logged = true
                } 
            }
        }
        if(!logged) {
            transferRoster.push(orignalNode + ">" + destonationNode)
            res.send("added new data to roster")
        }
        else {
            res.send("augmented roster")
        }
    })
    app.get("/more/:key", (req, res) => {
        if(req.params.key == "adminKey") {
            var capacities = [],
            capSum = 0,
            capMean = 0;
            for(var node in nodes) {
                var capacity = 1-(nodes[node][4]/35)
                capacities.push(capacity)
                capSum+=capacity
            }
            capMean = capSum / capacities.length
            var data = {
                "status": true,
                "nodes_in_network": nodes.length,
                "cache_data": dataToBeReintegrated.length,       
                "storage_capacities": capacities,
                "total_storage_capacity": ""+capMean*100+"%",
                "transfers_of_data": transferRoster
            }
            res.json(data)
        }
        else {
            res.json({"status": false, "body": "Failed Auth"})
        }

    })

    app.post("/data/clone-node", (req, res) => {
        var nodesSelected = 0,
        holdingNodeID = "",
        notDone = true
        nodes.forEach( node => {            
                if(node[2] == "proc" && node[4]<10 && node[1] != req.body.secondary && nodesSelected < 1 && notDone) {
                    notDone=false
                    node[2] = "reTake#"+req.body.data;
                    node[4]+=1;
                    holdingNodeID = node[1];
                    nodesSelected+=1;                    
                    node[0].send(node[2]);
                    console.log("cloning data into node")                
             }
        })
        res.send(""+holdingNodeID)
    })
    app.post("/data/upload", (req, res) => {
        var nodesSelected = 0;
        var holdingNodeIDs = []
        nodes.forEach( node => {
            if(nodesSelected!=2) {
                if(node[2] == "proc" && node[4]<30) {
                    node[2] = "hold#"+req.body.data;
                    node[4]+=1;
                    holdingNodeIDs.push(node[1]);
                    nodesSelected+=1;
                    node[0].send(node[2]);
                    console.log("pushing data into node", node[2])
                }
            }
        })
        res.send(holdingNodeIDs)
    })
    app.post("/data/query", (req, res) => {
        var done = false,
        id = "",
        qRes = ""
        found = false 
        
        id=req.body.node        
        for(var transfer in transferRoster) {
            transfer = transferRoster[transfer].split(">")             
            if(transfer[0].includes(req.body.node)) {      
                console.log(transfer, req.body.node)          
                id=transfer[1]
                done=true;

            }
        }
        nodes.forEach(node => {
            if(node[1] == id) {
                node[0].send("query#"+req.body.key);
                console.log("query", "id", node[1], "qID", id)
                console.log("query", "key", req.body.key)
                found = true;
                qRes = node[1];
            }
        })

        
        if(found) {
            res.send(`/${qRes}/data`)
        }
        else {
            res.send("notFound").status(404)
        }
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
        console.log("assigned task")
    })
    app.get("/:node/data", (req, res) => {
        nodes.forEach(node => {
            if(node[1] == req.params.node) {            
                var send = node[3] + ""
                console.log(send.substring(0, 2)+"...")
                node[3] = "res"
                res.send(send)
            }
        })
    })
    //server log
    app.listen(8000, () => console.log("server is listening on port 8000, happy coding"))