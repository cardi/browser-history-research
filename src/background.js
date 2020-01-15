// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

(function (){

let DEBUG = 0;

function handleClick(tab) {
  let url = browser.runtime.getURL('history.html');
  browser.tabs.create({url: url});
};

browser.browserAction.onClicked.addListener(handleClick);

// DEBUG: open up preferences page automatically
DEBUG && browser.tabs.create({url: browser.runtime.getURL('history.html') });

// set an alarm to fire:
//   (1) 2 minutes after browser launch, then
//   (2) every 24h afterwards
let alarmOptions = {
  delayInMinutes  : 2,
  periodInMinutes : 1440
}
if(DEBUG) {
  alarmOptions = {
    delayInMinutes  : 1,
    periodInMinutes : 1
  };
}
browser.alarms.create("check-experiment-end-and-notify", alarmOptions);

// when the alarm goes off, check if the experiment has ended and
// send notifications. do this check ~1/day to not continuously pester
// our volunteers.
browser.alarms.onAlarm.addListener( (alarmInfo) => {
  let now = new Date();
  let timeAfterExperiment = now - experiment.end; // milliseconds

  DEBUG && console.log(now, "on alarm:", alarmInfo.name, timeAfterExperiment);

  // after experiment.end, set browser action badge text
  if(DEBUG || timeAfterExperiment >= 0) {
    browser.browserAction.setBadgeText( {text: "!"});
  }

  // 1 day after experiment.end, send notification
  if(DEBUG || timeAfterExperiment >= 86400000) {
    browser.notifications.create("notify-exp-end", {
    	type    : "basic",
      iconUrl : browser.runtime.getManifest().browser_action.default_icon["32"],
    	title   : "Research experiment is done!",
    	message : "Please open the experiment page or click on this notification for instructions on submitting your results."
    });
  }

  // 2 days after experiment.end, open the experiment page
  if(timeAfterExperiment >= 172800000) {
    browser.tabs.create({url: browser.runtime.getURL('history.html') });
  }
});

// if notification clicked, open up the experiment page
browser.notifications.onClicked.addListener( (id) => {
  browser.tabs.create({url: browser.runtime.getURL('history.html') });
});

})();
