// Global vars
var map, myLocationMarker, myLocationCircle, chMarker, myLocation, feInt, cyInt, cy = 0, currentData = {},
UNKNOWN = "<B>UNKNOWN</B>"; 
centered = false, me=UNKNOWN, trails = [];
var socket = io();
var xhr1 = new XMLHttpRequest();
var xhr3 = new XMLHttpRequest();

// init Google Map
function initMap() {
  var mapCenter = new google.maps.LatLng(13.00, 77.65);
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 12,
//    center: mapCenter,
    streetViewControl: false,
    mapTypeControlOptions: {
      style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
      position: google.maps.ControlPosition.TOP_RIGHT
    }
  });

  // Stop centering markers after a drag operation
  map.addListener('drag', function () {
//    clearInterval(cyInt);
  });

  map.addListener('bounds_changed', function () {
    chMarker.setPosition(this.getCenter());
  });

  var icon = {
    url: "/images/blue-dot.png", // url
//    scaledSize: new google.maps.Size(50, 50), // scaled size
    origin: new google.maps.Point(0,0), // set origin
    anchor: new google.maps.Point(5, 5) // anchor (center of 10x10 icon image)
};

  myLocationMarker = new google.maps.Marker({
    icon: icon,
    height: '20px',
    map: map,
  });
  //myLocationMarker.setAnchor(new google.maps.Point(5,5));

  myLocationCircle = new google.maps.Circle({
    strokeColor: '#0080FF',
    strokeOpacity: 0.8,
    strokeWeight: 1,
    fillColor: '#0080FF',
    fillOpacity: 0.35,
    map: map,
    radius: 100
  });

  var chIcon = {
    url: "/images/crosshairs.png", // url
    scaledSize: new google.maps.Size(100, 100), // scaled size
    origin: new google.maps.Point(0,0), // set origin
    anchor: new google.maps.Point(50, 50) // anchor (center of 10x10 icon image)
};

  chMarker = new google.maps.Marker({
    icon: chIcon,
    map: map,
  });

  var controlDiv = document.createElement('div');
  controlDiv.style.paddingTop = '0px';
  controlDiv.style.pointerEvents = 'none';
  controlDiv.style.paddingLeft = '5px';
  var controlUI = document.getElementById('inputs');
  controlDiv.appendChild(controlUI);
  controlDiv.index = 1;
  map.controls[google.maps.ControlPosition.TOP_LEFT].push(controlDiv);
}

function showLocation() {
    myLocation = null;
    // Try HTML5 geolocation.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        myLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          acc: position.coords.accuracy
        };
        myLocationMarker.setPosition(myLocation);
        myLocationCircle.setCenter(myLocation);
        myLocationCircle.setRadius(myLocation.acc);
        myLocationMarker.setMap(map);
        myLocationCircle.setMap(map);
//        if(!centered) centerMyLocation();
        centered = true;
        if(document.getElementById("goToGPS")) document.getElementById("goToGPS").src = "/images/goToGPS.jpg";   
        if(me!==UNKNOWN) { 
          document.getElementById("locToGPS").src = "/images/locToGPS.jpg"; 
        }
      }, function() {
        document.getElementById("locToGPS").src = "/images/locToGPSgrey.jpg"; 
        document.getElementById("goToGPS").src = "/images/goToGPSgrey.jpg";
        myLocationMarker.setMap(null);
        myLocationCircle.setMap(null);
        console.log("Check Browser Location Permissions");
      });
      
    } else {
      document.getElementById("locToGPS").src = "/images/locToGPSgrey.jpg"; 
      document.getElementById("goToGPS").src = "/images/goToGPSgrey.jpg";   
      console.log("Browser doesn't support Geolocation");
    }
  }

  function centerMyLocation(p) {
    if(!myLocation) {
      var txt = "Location is unavailable. Check Browser Settings";
      showMessage("msg", txt, "white", "red");
      return false;
    }
//    if(p) clearInterval(cyInt);
    var latLng = new google.maps.LatLng(myLocation.lat, myLocation.lng);
    map.setCenter(myLocation);
    map.setZoom(15);
    return true;
}

var msgdisplaying = false;
function showMessage(div, txt, color, bgcolor, persistent) {
  msgdisplaying = true;
  if(txt===1) txt = "User's location set to GPS position (Blue Dot)";
  if(txt===2) txt = "User's location set to Map Center (Red Cross-Hairs)";
  if(txt===3) txt = "Centered map on GPS Position (Blue Dot)";
  txt = "<B>" + txt + "</B>";
  var msgDiv = document.getElementById(div);
  if(msgDiv) {
    msgDiv.style.backgroundColor = bgcolor; 
    msgDiv.style.color = color; 
    msgDiv.innerHTML = txt;
    if(bgcolor === "#FFFFFF") msgdisplaying = false;
    if(!persistent) {
      setTimeout(function() {
        msgDiv.innerHTML = "&nbsp;"; 
        msgDiv.style.backgroundColor = 'rgba(255,255,255,0.0)';
        msgdisplaying = false;
      }, 5000);
    }
  }
}

xhr3.onreadystatechange = function () {
  if (this.status == 200 && this.readyState == 4) {
    trails.forEach(function(p) {
      p.setMap(null);
      p = null;
    });
    Object.keys(currentData).forEach(function(name) {
      var popup = currentData[name].popup;
      popup.setMap(null);
      popup = null;
    });
    fetch();
    trails = [];
    trackData = JSON.parse(this.responseText);
    trackData.forEach(function(data) {
      var trackcoords = data.track.map(function(o) {return {lat: o.latitude,lng: o.longitude};});
      if(trackcoords && trackcoords.length > 0) {
        var path = new google.maps.Polyline({
          path: trackcoords,
          geodesic: true,
          strokeColor: '#FF0000',
          strokeOpacity: 1.0,
          strokeWeight: 2,
          map: map
        });
        trails.push(path);
      }
    });
  }
};

// WebSocket connection check
socket.on('connect', function (msg) {
  console.log('Connected to WS');
});
// Render new WebSocket received data
socket.on('message1', function (msg) {
  console.log(msg);
  render([msg]);
  xhr3.open('GET', "/redApi/trackData/?t=" + new Date().getTime() + "&u=" + me, true);
  xhr3.send();
});

socket.on('refresh', function (msg) {
  console.log('Refreshing on deletelast');
  fetch();
  xhr3.open('GET', "/redApi/trackData/?t=" + new Date().getTime() + "&u=" + me, true);
  xhr3.send();
});


// Get server data and render on first-time load of page
function fetch() {
  console.log("Fetch called");
  xhr1.onreadystatechange = function () {
    if (this.status == 200 && this.readyState == 4) {
      locations = JSON.parse(this.responseText);
      render(locations);
    }
  };
  xhr1.open('GET', "/redApi/locationData/?t=" + new Date().getTime() + "&u=" + me, true);
  xhr1.send();

}
var msgIndex = 0;
var msgs = ["&nbsp;&nbsp;Please enter a Username", "&nbsp;&nbsp;Kindly enter a non-whitespace Username", "&nbsp;&nbsp;Blank Username is not allowed!", "&nbsp;&nbsp;Seriously?", "&nbsp;&nbsp;Ha! I think you are just testing me :)"];


// Set ny name from addressbar anchor value into text box
function setMe(value) {
  if(value!==undefined && value.trim()==='') {
    showMessage("msg", msgs[msgIndex++], "white", "red");
    if(msgIndex>msgs.length - 1) msgIndex=0;
    return false;
  }
  if(value!==undefined) { me = value; }
  else if(window.location.href.split("#").length>1 && window.location.href.split("#")[1].trim() !== '') { me = window.location.href.split("#")[1]; } 
  if(me===UNKNOWN) {
    document.getElementById("locToGPS").src = "/images/locToGPSgrey.jpg";
    document.getElementById("locToCenter").src = "/images/locToCentergrey.jpg";
  } else {
//    document.getElementById("locToGPS").src = "/images/locToGPS.jpg";
    a = setInterval(function() {
      if(document.getElementById("locToCenter") != null) {
        document.getElementById("locToCenter").src = "/images/locToCenter.jpg";
        clearInterval(a);
      }
    }, 500);
    window.location.href = window.location.href.split("#")[0] + "#" + me;
  }

  b = setInterval(function() {
    if(document.getElementById('nameholder') != null) {
      document.getElementById('nameholder').innerHTML = "User: " + me;
      clearInterval(b);
    }
  }, 500);

  if(me!==UNKNOWN) showMessage("msg", "Username set to " + me, "white", "green");
  else showMessage("msg", "Username is " + me, "white", "red");
  return true;
}


function showAll() {
  var bounds = new google.maps.LatLngBounds();
  Object.keys(currentData).forEach(function(name) {
    var latLng = currentData[name].latLng;
    bounds.extend(latLng);
    map.fitBounds(bounds); 
  });
}
  
// Render location array data on map. Creates new markers for each new name, 
// updates position and time for existing markers. 
function render(results) {  // results --> Array [time (sec since 1/1/1970) , latitude (number), longitude (number), name, accuracy (m), type (GPS, NET, URL)]]
  var popup, c;
  for (var i = 0; i < results.length; i++) {
    if (!results[i].name) continue;  // Skip if data has no name
//    if(results[i].name==='Anirudh' && me!=='Ajith') continue;
    var latLng = new google.maps.LatLng(results[i].latitude, results[i].longitude);

    // Calculation of marker color based on recency. 0 sec implies Blue, CSECS sec implies White.
    var CSECS = 7200;  // Seconds at the end of which marker color turns white 
    var sec = results[i].time;  // in seconds from 1/1/1970
    var seconds = new Date().getTime() / 1000 - sec; // time elapsed since this location, in sec
    var R = Number(((255 * (seconds < CSECS ? seconds : CSECS) / CSECS)).toFixed(0));  // Get a number between 0 and 255 as elapsed time varies from 0 to CSECS.
    var textcolor = R > 128 ? "black" : "white";  // flip color for better contrast
    R = R.toString(16);   // convert to HEX
    R = (R.length == 1 ? "0" : "") + R; // pad HEX with 0 if required
    G = R;  // Green and Red to be same for Blue to fade to White
    B = "FF";  // Blue to be 255 always for Blue to fade to White
    var RGB = "#" + R + G + B;  // put RGB together
    

    // Calculate 'time ago' for displaying in marker
    var days = Math.floor(seconds / (3600 * 24));
    seconds -= days * 3600 * 24;
    var hrs = Math.floor(seconds / 3600);
    seconds -= hrs * 3600;
    var mnts = Math.floor(seconds / 60);
    seconds -= mnts * 60;
    t = (days != 0 ? days + "d " : "") + (hrs != 0 ? hrs + "h " : "") + (mnts != 0 ? mnts + "m " : "") + ((days == 0 && hrs == 0 && mnts == 0) ? seconds.toFixed(0) + "s " : "");
    
    // Create the marker
    var dv = document.createElement('div');
    dv.style.backgroundColor = RGB;
    dv.innerHTML = "<CENTER><img src='/images/" + results[i].name + ".jpg' alt='" + results[i].name + "'><BR><B><font color='" + textcolor + "'>" + t + " ago</font></B></CENTER>";
    if (!currentData[results[i].name]) {  // check if this is a new name
      popup = new Popup(latLng, dv);  // create a new Popup (marker)
      popup.setMap(map);

      // Push the new data into the currentData object
      currentData[results[i].name] = {};
      currentData[results[i].name].popup = popup;
      currentData[results[i].name].latLng = latLng;
      currentData[results[i].name].dbrec = results[i];
      if (results[i].accuracy) {  // check if accuracy is specified
        c = new google.maps.Circle({
          strokeColor: '#FF0000',
          strokeOpacity: 0.8,
          strokeWeight: 1,
          fillColor: '#FF0000',
          fillOpacity: 0.35,
          map: map,
          center: latLng,
          radius: results[i].accuracy
        });
        currentData[results[i].name].circle = c;
      }

    } else {  // if this is an existing name ...
      // retrieve data from currentData
      popup = currentData[results[i].name].popup;  
      c = currentData[results[i].name].circle;
      if (c) { c.setCenter(latLng); c.setRadius(results[i].accuracy); }
      if (!c && results[i].accuracy) {
        c = new google.maps.Circle({
          strokeColor: '#FF0000',
          strokeOpacity: 0.8,
          strokeWeight: 1,
          fillColor: '#FF0000',
          fillOpacity: 0.35,
          map: map,
          center: latLng,
          radius: results[i].accuracy
        });
        currentData[results[i].name].circle = c;
      }
      popup.setMap(null);
      popup = new Popup(latLng, dv);
      popup.setMap(map);
      currentData[results[i].name].popup = popup;
      currentData[results[i].name].dbrec = results[i];
      currentData[results[i].name].latLng = latLng;
    }
  }
  
}

// center the next marker when called
function cycle() {
  var names = Object.keys(currentData);
  currentLatLng = currentData[names[cy++]].latLng;
  if (cy > names.length - 1) cy = 0;
  map.setZoom(14);
  map.panTo(currentLatLng);
}

var shown = false;
// refresh times for all markers (using existing client data (no server call))
function refresh() {
  var data = Object.keys(currentData).map(function (o) {
    return (currentData[o].dbrec);
  });
  render(data);
  if(!shown) showAll();
  shown = true;
}

function setMapCenterAsMyLocation() {
  var mapCenter = map.getCenter();
  var resp = setLocationNow(mapCenter.lat(), mapCenter.lng());
  return resp;
}

function setLocationNow(lat, lng) {
  var name = me;
  if(!name || name.trim() ==='' || name===UNKNOWN) {
    showMessage("nameholder", "User: " + UNKNOWN, 'white', 'red', 1);
    showMessage("msg", "User is not set. Please set user.", "white", "red");
    setTimeout(function() {
      showMessage("nameholder", "User: " + UNKNOWN, 'black', 'lightgrey', 1);
      }, 5000);
    return false;
  }
  var xhr2 = new XMLHttpRequest();
  xhr2.onreadystatechange = function () { };
  var u = "/api/Locations/loc/?url=" + name + "/https://@" + lat + "," + lng + ",";
  xhr2.open('GET', u, true);
  xhr2.send();
  return true;
}

function keypressed(inputField, event) {
  if(event.keyCode == 13) {
    if(setMe(inputField.value))
    {
      document.getElementById('nameinput').style.display='none'; 
      document.getElementById('name').style.display='block';
    }
  } else if(event.keyCode == 27) {
    document.getElementById('nameinput').style.display='none'; 
    document.getElementById('name').style.display='block';
  }
};

function toggleHelp(p) {
  var elements = document.getElementsByClassName('child2');
  var newDisplay = 'none';
  if(elements[0].style.display !== 'table-cell') newDisplay = 'table-cell'; 
  if(p===1) newDisplay = 'table-cell'; 
  else if(p===0) newDisplay = 'none'; 
  for(var i=0; i<elements.length; i++) {
    elements[i].style.display = newDisplay;
  }
}


// refresh and cycle every 5 seconds
feInt = setInterval(refresh, 5000);
//cyInt = setInterval(cycle, 5000);
setInterval(showLocation, 5000);