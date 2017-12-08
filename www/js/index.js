// (c) 2014 Don Coleman
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/* global mainPage, deviceList, refreshButton */
/* global detailPage, resultDiv, messageInput, sendButton, disconnectButton */
/* global ble  */
/* jshint browser: true , devel: true*/


var prefix = "s";
var suffix = "e";
var login = "L";// total passw chars 12
var userpwd = "U";
var adminpwd = "A";
var powercmdON = "PN";
var powercmdOFF = "PF";
var throttle = "T";
var setBTname = "N";
var errorMsg = "E";
var StatusCmd = "S";

var space = " ";


var $$ = Dom7;

// Initialize your app
var myApp = new Framework7({
	modalTitle: 'Trekker',
	swipePanel: 'left',
	onPageInit: function (page) {
 
    }	
	//domCache: true
/*	template7Pages: true,
    onAjaxStart: function (xhr) {
        myApp.showPreloader();
    },
    onAjaxComplete: function (xhr) {
        myApp.hidePreloader();
    }*/	
});

var loginview = myApp.addView('#loginview');
var indexview = myApp.addView('#indexview');
//var scanview = myApp.addView('#scanview', {
    // Because we use fixed-through navbar we can enable dynamic navbar
	// dynamicNavbar: true
	//}
var aboutview = myApp.addView('#aboutview');


var numpadInline = myApp.keypad({
  input: '#numpad-inline',
  container: '#numpad-inline-container',
  toolbar: false,
  valueMaxLength: 4,
  dotButton: true,
  //formatValue: function(p, value) {
	//value = value.toString();
	//return ('****').substring(0, value.length) + ('____').substring(0, 4 - value.length);
	//return (value).substring(0, value.length);
  //},
  onChange: function (p, value) {
	value = value.toString();
	console.log("onchange: string:"+value);
	if (value.length === 4) {
		setTimeout(function(){app.connect()},1000);
	}
  }
});


// ASCII only
function bytesToString(buffer) {
    return String.fromCharCode.apply(null, new Uint8Array(buffer));
}

// ASCII only
function stringToBytes(string) {
    var array = new Uint8Array(string.length);
    for (var i = 0, l = string.length; i < l; i++) {
        array[i] = string.charCodeAt(i);
    }
    return array.buffer;
}

function bytesToHex(bytes) {
    var string = [];
    for (var i = 0; i < bytes.length; i++) {
      string.push("0x" + ("0"+(bytes[i].toString(16))).substr(-2).toUpperCase());
    }
    return string.join(" ");
}

//pad('            ',number,true|false);
function pad(pad, str, padLeft) {
  if (typeof str === 'undefined') 
    return pad;
  if (padLeft) {
    return (pad + str).slice(-pad.length);
  } else {
    return (str + pad).substring(0, pad.length);
  }
}

// this is Nordic's UART service
var trekker = {
    serviceUUID: 'FFE0',
    txCharacteristic: 'FFE1', // transmit is from the phone's perspective
    rxCharacteristic: 'FFE1',  // receive is from the phone's perspective
	deviceId:"",
	deviceName:""
};

var app = {
    initialize: function() {
        this.bindEvents();
        detailPage.hidden = true;
    },
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
        //refreshButton.addEventListener('touchstart', this.refreshDeviceList, false);
        sendButton.addEventListener('click', this.sendDataStart, false);
        disconnectButton.addEventListener('touchstart', this.disconnect, false);
        //deviceList.addEventListener('touchstart', this.connect, false); // assume not scrolling
		deviceList.addEventListener('touchstart', this.showLogin, true); 
				;
    },
	showLogin:function(event){
		if (event.target.dataset.deviceId)
			$$("#loginview").addClass("modal-in");
	},
    onDeviceReady: function() {
        ble.isEnabled(
            function() {
				app.refreshDeviceList();
                console.log("Bluetooth is enabled");
            },
            function() {
				alert("Bluetooth is *not* enabled");
                console.log("Bluetooth is *not* enabled");
            }
        ); 		
    },
    refreshDeviceList: function() {
        deviceList.innerHTML = ''; // empties the list
        ble.scan([trekker.serviceUUID], 5, app.onDiscoverDevice, app.onError);
        
        // if Android can't find your device try scanning for all devices
        // ble.scan([], 5, app.onDiscoverDevice, app.onError);
    },
    onDiscoverDevice: function(device) {
		myApp.showPreloader();
        var listItem = document.createElement('li'),
            html = '<b>' + device.name + '</b><br/>' +
                'RSSI: ' + device.rssi + '&nbsp;|&nbsp;' +
                'DeviceID:' + device.id;
	//alert(JSON.stringify(device));
        listItem.dataset.deviceId = device.id;
		
		trekker.deviceId = device.id;
		trekker.deviceName = device.name;
       
        listItem.innerHTML = html;
        deviceList.appendChild(listItem);
		myApp.hidePreloader();
    },
    connect: function() {
		console.log("connecting...");
	
		var pwd = $$("#numpad-inline").val().toString();
		console.log("connecting string"+pwd);
		if (pwd.length===4){
			
				onConnect = function(peripheral) {
					console.log("connected");
					myApp.showPreloader();
							//app.determineWriteType(peripheral);
							//resultDiv.innerHTML = JSON.stringify(peripheral, null, 2);
					//app.writeWithoutResponse = false;
					// subscribe for incoming data
					ble.startNotification(trekker.deviceId, trekker.serviceUUID, trekker.rxCharacteristic, app.onData, app.onError);
					sendButton.dataset.deviceId = trekker.deviceId;
					disconnectButton.dataset.deviceId = trekker.deviceId;
					resultDiv.innerHTML = "";
					app.authenticate();
				};

			ble.connect(trekker.deviceId, onConnect, app.onError);
		}
    },
    determineWriteType: function(peripheral) {
        var characteristic = peripheral.characteristics.filter(function(element) {
            if (element.characteristic.toLowerCase() === trekker.txCharacteristic) {
                return element;
            }
        })[0];

        if (characteristic.indexOf('WriteWithoutResponse') > -1) {
            app.writeWithoutResponse = true;
        } else {
            app.writeWithoutResponse = false;
        }

    },
    onData: function(data) { // data received
        console.log(data);
		var result = bytesToString(data);
		
        //resultDiv.innerHTML = resultDiv.innerHTML + "Received: " + bytesToString(data) + "<br/>";
        //resultDiv.scrollTop = resultDiv.scrollHeight;
		console.log("Received: " + bytesToString(data));
		
		levelBar = $$('.level');
		
		// STATUS variables
		var result_powerStatus = "F"; 
		var result_throtleStatus = "000";
		var result_throtleLimit = "000";
		var result_batteryStatus = "00000";
		
		var resultsData = {
						"charging":false,
						"powerStatus":result_powerStatus,
						"batteryStatus":result_batteryStatus,
						"throtleStatus":result_throtleStatus,
						"throtleLimit":result_throtleLimit,
						};	
		
		/* Check Status */
		// check if it starts with prefix
		var prefix_res = result.substring(0,1);
		var suffix_res = result.substring(result.length,-1);
		var command_str = result.substring(1,1);
	
		// check if this is a string with correct prefix and suffix value
		if (prefix_res===prefix && suffix_res===suffix){
			if (command_str===errorMsg || command_str===StatusCmd){
				// valid variables after prefixes
				
				// STATUS RESULTS
				if (command_str===StatusCmd){
					resultsData.powerStatus = result.substring(2,1);
					resultsData.throtleStatus = parseFloat(result.substring(3,3),10).toFixed(2);
					resultsData.throtleLimit = parseFloat(result.substring(6,3),10).toFixed(2);
					resultsData.batteryStatus = parseFloat(result.substring(10,5),10).toFixed(2);
				}
				else if(command_str===errorMsg){
					alert("Error:"+result.substring(1,(result.length-1)));
				}
			}
			else{// INVALID variables after prefixes
				alert.log("Wrong command format!");
			}			
		}
		else{//INVALID prefix or suffix
			alert.log("Wrong prefix && suffix format!");
		}
		// check if this is a string with correct start and end values
		/* Check Status */
		
		// BATERY STATUS
		if (resultsData.charging) {
		  levelBar.addClass('charging');
		} else if (resultsData.batteryStatus > 20000) {
		  levelBar.addClass('high');
		} else if (resultsData.batteryStatus >= 12000 ) {
		  levelBar.addClass('med');
		} else {
		  levelBar.addClass('low');
		};
		
		resultsData.innerHTML = resultsData.batteryStatus;
		
		levelBar.css('width', level + '%');
		
		// POWER STATUS
		if (resultsData.powerStatus==="F"){
			sendButton.innerHTML = "START Engine";
			$$(".leds").addClass("led-off");
		}
		else{
			sendButton.innerHTML = "STOP Engine";
			$$(".leds").addClass("led-on");
		}
		
		// THROTTLE STATUS
		

    },
	authenticate: function() { 
        var success = function() {
            console.log("authenticate success");
            //resultDiv.innerHTML = resultDiv.innerHTML + "Sent: " + pad('            ',prefix+login+$$("#numpad-inline").val()+suffix,false); + "<br/>";
            //resultDiv.scrollTop = resultDiv.scrollHeight;
			$$("#indexview").addClass("active");
			$$("#loginview").removeClass("modal-in");
			app.showDetailPage();
        };

        var failure = function(e) {
			alert('Failed logging in to Trekker\n'+e);
			myApp.hidePreloader();
        };
		console.log("authenticate...");
		var strtoSend = prefix+login+"1234        "+suffix;//pad('            ',prefix+login+$$("#numpad-inline").val()+suffix,false);
		
		console.log("send connect string"+strtoSend);
		
		var data = stringToBytes(strtoSend.toString());
		
        //if (app.writeWithoutResponse) {
            ble.writeWithoutResponse(
                trekker.deviceId,
                trekker.serviceUUID,
                trekker.txCharacteristic,
                data, success, failure
            );
        /*} else {
            ble.write(
                trekker.deviceId,
                trekker.serviceUUID,
                trekker.txCharacteristic,
                data, success, failure
            );
        }*/	
	},
    sendDataStart: function(event) {

        var success = function() {
            console.log("success");
            //resultDiv.innerHTML = resultDiv.innerHTML + "Sent: " + prefix+powercmdON+suffix + "<br/>";
            //resultDiv.scrollTop = resultDiv.scrollHeight;
        };

        var failure = function(e) {
            alert("Failed writing data to the Trekker\n"+e);
			myApp.hidePreloader();
        };

		var data = stringToBytes(prefix+powercmdON+suffix);//prefix+powercmdON+suffix;
        var deviceId = event.target.dataset.deviceId;

        //if (app.writeWithoutResponse) {
            ble.writeWithoutResponse(
                deviceId,
                trekker.serviceUUID,
                trekker.txCharacteristic,
                data, success, failure
            );
        /*} else {
            ble.write(
                deviceId,
                trekker.serviceUUID,
                trekker.txCharacteristic,
                data, success, failure
            );
        }*/

    },
    disconnect: function(event) {
        var deviceId = event.target.dataset.deviceId;
        ble.disconnect(deviceId, app.showMainPage, app.onError);
    },
    showMainPage: function() {
        mainPage.hidden = false;
        detailPage.hidden = true;
		location.href='index.html';
    },
    showDetailPage: function() {
        mainPage.hidden = true;
        detailPage.hidden = false;
		myApp.hidePreloader();
    },
    onError: function(reason) {
		myApp.hidePreloader();
        alert("ERROR: " + reason.errorDescription + "\n" + reason.errorMessage);//JSON.stringify(reason)); // real apps should use notification.alert
    }
};


