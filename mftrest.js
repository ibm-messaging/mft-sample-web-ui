/*
 * Copyright (c) 2018 IBM Corporation.
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 */

/*
 * Simple JavaScript for use by the accompanying agentstatus.html and 
 * transferstatus.html files
 */

//Set on log-in, nulled on log-out.
var cachedCSRFToken = "novalue";
var loggedInAlready = false;
var includeAttributesInResponse = false;

function onLoad() {
  setButtonState();
}

function setButtonState() {

}

function securityEnabledClicked() {

}

function showLoginDetails() {
  var url = getBaseURLPrefix() + "login";
  submitCommonGETRequest(url, printLoginDetails, updateResponse);
}

function printLoginDetails(json) {
  var arrayLength = json.user.length;

  for (var i = 0; i < arrayLength; i++) {
    appendText("User " + json.user[i].name + " is in these role(s): " + json.user[i].role + ".");
  }
}

function unexpectedErrorHandler(msg, statusCode, json) {
  var respDis = document.getElementById('Response');
  var errorMsg =    "Message:     " + json.error[0].message + "</br>" +
                    "Explanation: " + json.error[0].explanation + "</br>" +
                    "Action:      " + json.error[0].action;

  respDis.innerHTML = errorMsg;
}

function appendText(text) {
  var responseVar = document.getElementById("Response");
  responseVar.innerHTML = escapeHtml(text);
}

function clearInput() {
  var agentName = document.getElementById("agentNameInput");
  agentName.value = "*";
}

function escapeHtml(text) {
  return text
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");
}

function appendBlankLine() {
  var resultsDiv = document.getElementById("results");
  var resultDiv = document.createElement("div"); 
  resultDiv.innerHTML = "<br/>";
  resultsDiv.appendChild(resultDiv);
}

function getAdminURLPrefix() {
  return getInput("urlRoot") + "ibmmq/rest/v1/admin/";
}

function getMFTAdminURLPrefix() {
  return getInput("urlRoot") + "ibmmq/rest/v1/admin/mft/";
}

function getBaseURLPrefix(){
  return getInput("urlRoot") + "ibmmq/rest/v1/";
}

function getInput(inputName) {
  return document.getElementById(inputName).value;
}

function submitCommonGETRequest(url, control, successCallback, errorCallback) {
  resetResponse();
  outputURL(url, control);

  //Login passing in function to call if login succeeds.
  login(function() {      
    var request = new XMLHttpRequest();

    //Need this to allow LTPA/Session cookies to be flowed/accessed.
    request.withCredentials = true;
    request.open("GET", url, true);

    // register handler for on progress 
    request.onprogress = function() {
      var results = document.getElementById("lastTransferID");
      if(this.readyState == 2){
        totalTransfers = request.getResponseHeader("ibm-mq-rest-mft-total-transfers");        		
      }    	  
    };

    //Register handler for result.
    request.onload = function () {
      var totalTransfers = 0;

      if(request.status == 200) {
        successCallback(JSON.parse(request.response), request.status );
      }
      else {
        errorCallback("on get", request.status, JSON.parse(request.response));
      }

      logout();
    };

    //Send request.
    request.send();
  });
}

/**  Clear contents of transfer controls */
function clearTransfers() {
  var transferPage = document.getElementById('pageName');
  if(transferPage.value == "transferStatusHidden") {
    var results = document.getElementById("transferStatusTableAreaBody");
    while(results.firstChild) {
      results.removeChild(results.firstChild);
    }		
  }
}

/** Display the URL being executed */
function outputURL(url, control) {
  control.innerHTML = url; 
}

/* Run Login REST API */
function login(successCallback) {
  if(isSecurityEnabled()) {
    var url = getBaseURLPrefix() + "login";

    var request = new XMLHttpRequest();

    //Need this to allow LTPA/Session cookies to be flowed/accessed.
    request.withCredentials = true;
    request.open("POST", url, true);
    request.setRequestHeader('Content-Type','application/json');

    var userId = getInput("userId");
    var password = getInput("password");

    request.onload = function () {            
      if(request.status == 204) {
        //Stash CSRF token.
        cachedCSRFToken = getCSRFToken();
        //Drive callers callback.
        successCallback(); 
      } else if(request.status == 400) {
        //var message = JSON.parse(request.response);
        loggedInAlready = true;
        updateResponse("on login", request.status, JSON.parse(request.response));        	
      } else {
        updateResponse("on login", request.status, JSON.parse(request.response));        	
      }
    };

    request.onerror = function() {
      appendText("An unexpected error has occurred. This might be caused by CORS.");
    };

    //Send request.
    var stringified = JSON.stringify({"username" : userId, "password" : password}); 
    request.send(stringified);
  } 
  else {
    //Drive the callback directly.
    successCallback();
  }
}

function isSecurityEnabled() {
  if(loggedInAlready) 
    return false;
  
  return document.getElementById("securityEnabled").checked;
}

function getCSRFToken() {
  var token = "";
  var cookieName = "csrfToken=";

  //Get the CSRF token from the cookies returned by logging in to the 
  //REST API.
  var cookies = document.cookie.split(";");

  for(var i=0; i < cookies.length; i++) {
    var cookie = cookies[i].trim();

    if(cookie.startsWith(cookieName)) {
      token = cookie.substring(cookieName.length,cookie.length)
    }
  }

  return token;
}

/* Run Logout REST API */
function logout() {
  if(isSecurityEnabled()) {
    var url = getBaseURLPrefix() + "login";

    var request = new XMLHttpRequest();

    //Need this to allow LTPA/Session cookies to be flowed/accessed.
    request.withCredentials = true;
    request.open("DELETE", url, true);

    request.setRequestHeader('ibm-mq-rest-csrf-token', cachedCSRFToken);

    request.onload = function () {      
      //Null out CSRF token as we have logged out.
      cachedCSRFToken = "novalue";      
      if(request.status != 204) {
        updateResponse("on logout", request.status, JSON.parse(request.response));
      }
    };

    request.send();
  }
}

/**
 * Run list transfer status REST API
 * @returns none
 */
function showAllTransfers() {
  var transferQueryInput = getInput('transferIDInput');
  var transferUrlSuffix = "transfer";

  if(document.getElementById('includeAttributes').checked) {
    includeAttributesInResponse = true;
  } else {
    includeAttributesInResponse = false;    
  }

  if(document.getElementById('radioAllXfers').checked) {
    transferUrlSuffix += (includeAttributesInResponse == true ?"?attributes=*" : "");
  } else if(document.getElementById('radioAfter').checked) {
    transferUrlSuffix += "?" + "after=" + transferQueryInput + (includeAttributesInResponse == true ? "&attributes=*" : "");
  } else {
    transferUrlSuffix += "?" + "before=" + transferQueryInput + (includeAttributesInResponse == true ? "&attributes=*":"");
  }
  
  // Build URL string
  var url = getMFTAdminURLPrefix() + transferUrlSuffix;
  submitCommonGETRequest(url, document.getElementById('APIURL'), printAllTransferResults, updateResponse);	  
}

/* Run list single transfer status REST API */
function showOneTransfer() {
  var transferQueryInput = getInput('transferIDDetails');
  var transferUrlSuffix = "transfer/";

  if(transferQueryInput =='*' || transferQueryInput.trim() == '')
    transferUrlSuffix += "?attributes=*";
  else {
    transferUrlSuffix += transferQueryInput + "?" + "attributes=*";
  }
  // Build the URL for single transfer REST API
  var url = getMFTAdminURLPrefix() + transferUrlSuffix;
  clearOneTransfer();
  submitCommonGETRequest(url, document.getElementById('APIURL'), printOneTransferResult, updateResponse);	  
}

/* Clear controls */
function clearOneTransfer() {
  document.getElementById('transferIDDetails').value="";
  clearTable('singleTransferStatusTableAreaBody');
}

/**
 * Display all transfers status
 * @param result
 * @returns
 */
function printAllTransferResults(result, statuscode) {
  var arrayLength = result.transfer.length;
  clearTransfers();
  updateResponse("", statuscode, result);
  
  if(arrayLength == 0) {
    var respDis = document.getElementById('Response');
    respDis.style.fontSize = "15px";
    respDis.innerHTML = "" + "No transfers found";
    
    clearTable('transferStatusTableAreaBody');
  }
  else {	   
    var transferStatusTable = document.getElementById('transferStatusTableAreaBody');
    var resultIndex = 0;

    clearTable('transferStatusTableAreaBody');

    transferStatusTable.style.display = "";  //Show the table
    var fontSize = "12px";
    for (var i = 0; i < arrayLength; i++){
      var existingRow = $('transferStatusTableAreaBody').find('#'+ 'tr_ + ' + result.transfer[resultIndex].id);
      if(existingRow.length == 0) {
        var transferRow = transferStatusTable.insertRow(i);
        transferRow.id = 'tr_ + ' + result.transfer[resultIndex].id;
        var sourceNameCell 		= transferRow.insertCell(0);
        var destinationCell     = transferRow.insertCell(1);
        var statusCell   		= transferRow.insertCell(2);
        var startTime     		= transferRow.insertCell(3);
        var endTime     		= transferRow.insertCell(4);
        var transferIDCell 		= transferRow.insertCell(5);

        sourceNameCell.width = "14%";
        destinationCell.width = "14%";
        statusCell.width = "14%";
        startTime.width = "14%";
        endTime.width = "14%";
        transferIDCell.width = "30%";

        sourceNameCell.style.fontSize = fontSize;
        destinationCell.style.fontSize = fontSize;
        statusCell.style.fontSize = fontSize;
        startTime.style.fontSize = fontSize;
        endTime.style.fontSize = fontSize;
        transferIDCell.style.fontSize = fontSize;

        sourceNameCell.innerHTML  = result.transfer[resultIndex].sourceAgent.name;
        destinationCell.innerHTML = result.transfer[resultIndex].destinationAgent.name;
        transferIDCell.innerHTML= result.transfer[resultIndex].id;
        statusCell.innerHTML = result.transfer[resultIndex].status.state.toUpperCase().bold();
        
        if((result.transfer[resultIndex].status.state == 'completed') ||
            (result.transfer[resultIndex].status.state == 'failed'))	{
          statusCell.style.color = 'red';
        } else if(result.transfer[resultIndex].status.state == 'inProgress') {
          statusCell.style.color = 'orange';
        } else if (result.transfer[resultIndex].status.state == 'successful') {
          statusCell.style.color = 'green';  					
        } else if (result.transfer[resultIndex].status.state == 'started') {
          statusCell.style.color = 'black';  					  					
        } else if (result.transfer[resultIndex].status.state == 'cancelled') {
          statusCell.style.color = 'blue';    					
        }
        startTime.innerHTML = result.transfer[resultIndex].statistics.startTime;
        endTime.innerHTML = result.transfer[resultIndex].statistics.endTime;
      } else {
        existingRow.find("td").eq(3).html(result.transfer[resultIndex].status.state);
      }
      resultIndex ++;
    }
  }	
}

/* Display details of single transfer */
function printOneTransferResult(result, statuscode) {
  updateResponse("", statuscode, result);
  var details = "";
  var row = 0;
  
  var singleTransferStatusTable = document.getElementById('singleTransferStatusTableAreaBody');
  
  var transferIDRow = singleTransferStatusTable.insertRow(row++);
  transferIDRow.insertCell(0).innerHTML = "Transfer ID";  
  transferIDRow.insertCell(1).innerHTML = result.transfer[0].id;
  
  var sourceAgentRow = singleTransferStatusTable.insertRow(row++);
  sourceAgentRow.insertCell(0).innerHTML = "Source Agent";
  sourceAgentRow.insertCell(1).innerHTML = result.transfer[0].sourceAgent.name;
  sourceAgentRow.insertCell(2).innerHTML = "Queue Manager";
  sourceAgentRow.insertCell(3).innerHTML = result.transfer[0].sourceAgent.qmgrName;
  
  var destAgentRow = singleTransferStatusTable.insertRow(row++);
  destAgentRow.insertCell(0).innerHTML = "Destination Agent";
  destAgentRow.insertCell(1).innerHTML = result.transfer[0].sourceAgent.name;
  destAgentRow.insertCell(2).innerHTML = "Queue Manager";
  destAgentRow.insertCell(3).innerHTML = result.transfer[0].sourceAgent.qmgrName;
  
  var originatorRow = singleTransferStatusTable.insertRow(row++);
  originatorRow.insertCell(0).innerHTML = "Originator";
  originatorRow.insertCell(1).innerHTML = "Host: " + result.transfer[0].originator.host 
                                          + ", MQMD User ID: " + result.transfer[0].originator.mqmdUserId 
                                          + ", User ID: " + result.transfer[0].originator.mqmdUserId;
  
  var statisticsRow = singleTransferStatusTable.insertRow(row++);
  statisticsRow.insertCell(0).innerHTML = "Statistics";
  statisticsRow.insertCell(1).innerHTML =   "Start Time: " + result.transfer[0].statistics.startTime
                                          + "<br/>End Time: " + result.transfer[0].statistics.endTime
                                          + "<br/>Successful: " + result.transfer[0].statistics.numberOfFileSuccesses
                                          + "<br/>Failed: " + result.transfer[0].statistics.numberOfFileFailures 
                                          + "<br/>Warnings: " + result.transfer[0].statistics.numberOfFileWarnings
                                          + "<br/>Total: " + result.transfer[0].statistics.numberOfFiles;
  
  var statusRow = singleTransferStatusTable.insertRow(row++);
  statusRow.insertCell(0).innerHTML = "Status";
  statusRow.insertCell(1).innerHTML =   "Description: " + result.transfer[0].status.description 
                                      + "<br/>Status updated at: " + result.transfer[0].status.lastStatusUpdate
                                      + "<br/>State: " +  result.transfer[0].status.state;
  // Transfer Set
  var transferSetRow = singleTransferStatusTable.insertRow(row++);
  transferSetRow.insertCell(0).innerHTML = "Transfer Items";

  // Iterate through the items in transfer set and list them in table  
  var transferSetSize = result.transfer[0].transferSet.item.length;
  for (var index = 0; index < transferSetSize; index++) {
    var transferItemRow = singleTransferStatusTable.insertRow(row++);
    var itemCell = transferItemRow.insertCell(0);
    var cellText = "Item #" + index;

    cellText += "<hr/>" + result.transfer[0].transferSet.item[index].status.description
    
    transferItemEndPointRow = singleTransferStatusTable.insertRow(row++);
    var sourceItem = "";
    var destItem = "";

	// The current source item type is file.
    if(result.transfer[0].transferSet.item[index].source.type == "file") {
      sourceItem = "File: " + result.transfer[0].transferSet.item[index].source.file.path
                  +"<br/>Size: " + result.transfer[0].transferSet.item[index].source.file.size
                  +"<br/>Last modified: " + result.transfer[0].transferSet.item[index].source.file.lastModified
                  +"<br/>Checksum: Method: " + result.transfer[0].transferSet.item[index].source.checksum.method 
                  + " Value: " + result.transfer[0].transferSet.item[index].source.checksum.value
                  +"<br/>Disposition: " + result.transfer[0].transferSet.item[index].source.disposition;
    } else {
      // Queue and other types
    }
    
	// The current destination item type is file
    if(result.transfer[0].transferSet.item[index].destination.type == "file") {
      destItem = "File: " + result.transfer[0].transferSet.item[index].destination.file.path
      +"<br/>Size: " + result.transfer[0].transferSet.item[index].destination.file.size
      +"<br/>Last modified: " + result.transfer[0].transferSet.item[index].destination.file.lastModified
      +"<br/>Checksum: Method: " + result.transfer[0].transferSet.item[index].destination.checksum.method 
      + " Value: " + result.transfer[0].transferSet.item[index].destination.checksum.value
      +"<br/>Action If Exists: " + result.transfer[0].transferSet.item[index].destination.actionIfExists;
    } else {
		// Queue or other types
    }
	
    cellText += "<br/><b>Source</b><br/>" + sourceItem + "<br/>";
    cellText += "<br/><b>Destination</b><br/>" + destItem;
    itemCell.innerHTML = cellText + "<hr/>";    
  }
}

/**
 * Build URL to display status of all agents with all attributes and 
 * run.
 * @returns
 */
function showAllAgentStatus() {
  var agentNameFromInput = getInput('agentNameInput');
  var agentUrlSuffix = "agent";
  
  if(document.getElementById('includeAttributes').checked) {
    includeAttributesInResponse = true;
  } else {
    includeAttributesInResponse = false;    
  }
  
  if(document.getElementById('radioAll').checked) {
    if(agentNameFromInput =='*')
      agentUrlSuffix += (includeAttributesInResponse==true ? "/?attributes=*": "");
    else if(agentNameFromInput.includes('*')) {
      agentUrlSuffix += "?name=" + agentNameFromInput + (includeAttributesInResponse==true ? "&attributes=*":"");            
    } else {
      agentUrlSuffix += "/" + agentNameFromInput + (includeAttributesInResponse==true ? "?attributes=*":"");
    }
  } else if(document.getElementById('radioType').checked) {
    if(agentNameFromInput =='*')
      agentUrlSuffix += "?type=*" + (includeAttributesInResponse==true ? "&attributes=*" : "");
    else {
      agentUrlSuffix += "?type=" + agentNameFromInput + "&attributes=*";      
    }

  } else if(document.getElementById('radioState').checked) {
    if(agentNameFromInput =='*')
      agentUrlSuffix += "?state=*" + (includeAttributesInResponse==true ? "&attributes=*" :"");
    else {
      agentUrlSuffix += "?state=" + agentNameFromInput + (includeAttributesInResponse==true ? "&attributes=*":"");      
    }
  }

  var url = getMFTAdminURLPrefix() + agentUrlSuffix;

  clearTable('agentStatusTableAreaBody');
  resetCounters();
  // disable the showAllAgentStatus button while we get response from server
  document.getElementById("showAllAgents").disabled = true;
  submitCommonGETRequest(url, document.getElementById('APIURL'),printAllAgentsResult, updateResponse);
}

/**
 * Clears the Agents Status table
 * @returns
 */
function clearTable(tableArea) {
  var dataTable = document.getElementById(tableArea);
  dataTable.style.display = "none";  //Hide the table
  // first clear rows if any
  var rowCount = dataTable.rows.length;
  for (var x=rowCount-1; x > -1; x--) {
    dataTable.deleteRow(x);
  }	  
  dataTable.style.display = "";  //Show the table
}

function resetResponse() {
  document.getElementById('APIURL').innerHTML = "";
  document.getElementById('ResponseCode').innerHTML = "";
  document.getElementById('Response').innerHTML = "";
}

function resetCounters() {
  document.getElementById('agentStateCountReady').innerHTML = 0;
  document.getElementById('agentStateCountActive').innerHTML = 0;
  document.getElementById('agentStateCountStopped').innerHTML = 0;
  document.getElementById('agentStateCountUnknown').innerHTML = 0;
}
/**
 * Update the table with agent status.
 * @param result
 * @returns
 */
function printAllAgentsResult(result, statuscode) {
  var arrayLength = result.agent.length;
  // Enable showAllAgentStatus button as we got some response
  document.getElementById("showAllAgents").disabled = false;
  updateResponse("", statuscode, result);

  var idLabelReady = document.getElementById('agentStateCountReady');
  var idLabelActive = document.getElementById('agentStateCountActive');
  var idLabelStopped = document.getElementById('agentStateCountStopped');
  var idLabelUnknown = document.getElementById('agentStateCountUnknown');

  if(arrayLength == 0) {
    resetCounters();
  }
  else {
    var agentStatusTable = document.getElementById('agentStatusTableArea');
    agentStatusTable.style.display = "";
    var agentStatusTableBody = document.getElementById('agentStatusTableAreaBody');
    agentStatusTableBody.style.height = "110px";

    var countReady = 0;
    var countActive = 0;
    var countStopped = 0;
    var countUnknown = 0;

    var resultIndex = 0;
    for (var i = 0; i < arrayLength; i++){
      var agentRow = agentStatusTableBody.insertRow(i);
      var agentNameCell 		= agentRow.insertCell(0);
      var agentTypeCell     	= agentRow.insertCell(1);
      var agentQmgrNameCell 	= agentRow.insertCell(2);
      var agentStatusCell   	= agentRow.insertCell(3);
      var agentStatusAgeCell  = agentRow.insertCell(4);

      agentNameCell.style.width="20%";
      agentTypeCell.style.width="20%";
      agentQmgrNameCell.style.width="20%";
      agentStatusCell.style.width="20%";
      agentStatusAgeCell.style.width="20%";

      agentNameCell.innerHTML      = result.agent[resultIndex].name;
      agentStatusCell.innerHTML    = result.agent[resultIndex].state.toUpperCase().bold();

      if(result.agent[resultIndex].state == 'ready') {
        agentStatusCell.style.color = "green";
        agentStatusCell.style.bold=true;
        countReady += 1;
      } else if (result.agent[resultIndex].state == 'unknown') {
        agentStatusCell.style.color = "red";
        agentStatusCell.style.bold=true;
        countUnknown += 1;
      } else if (result.agent[resultIndex].state == 'active') {
        agentStatusCell.style.color = "orange";
        agentStatusCell.style.bold=true;
        countActive += 1;
      } else if (result.agent[resultIndex].state == 'stopped') {
        agentStatusCell.style.color = "blue";
        agentStatusCell.style.bold=true;
        countStopped += 1;
      }

      agentTypeCell.innerHTML      = result.agent[resultIndex].type.toUpperCase();
      if(includeAttributesInResponse) {
        agentQmgrNameCell.innerHTML  = result.agent[resultIndex].qmgrConnection.qmgrName.toUpperCase();
        agentStatusAgeCell.innerHTML = result.agent[resultIndex].general.statusAge;        
      }
      resultIndex ++;
    }

    idLabelReady.innerHTML = countReady;
    idLabelActive.innerHTML = countActive;
    idLabelStopped.innerHTML = countStopped;
    idLabelUnknown.innerHTML = countUnknown;	  
  }
}

/* Display the response received */
function updateResponse(msg, statusCode, json) {
  var respCode = document.getElementById('ResponseCode');
  respCode.innerHTML = statusCode;
  var respDis = document.getElementById('Response');
  
  if(statusCode >= 400) {
    var errorMsg =    "Message:     " + json.error[0].message + "</br>" +
    "Explanation: " + json.error[0].explanation + "</br>" +
    "Action:      " + json.error[0].action;

    respDis.style.fontSize = "12px";
    respDis.innerHTML = errorMsg;
	var agStsButton = document.getElementById('showAllAgents');
	if(agStsButton != null) {
		if(agStsButton.disabled == true)
			agStsButton.disabled = false;
	}
  } else {
    respDis.style.fontSize = "15px";
    respDis.innerHTML = "Success"
  }
}

function getAgentName() {
  return agentName = getInput("agentName");
}

function showSpecifiedAgentStatus() {
  var url = getAdminURLPrefix() + "agent/" + getAgentName() + "?status=*";
  submitCommonGETRequest(url, printAgentStatusResult, updateResponse);
}

