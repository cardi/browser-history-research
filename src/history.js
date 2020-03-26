// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

(async function (){

// from: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
async function digestMessage(message) {
  const msgUint8 = new TextEncoder().encode(message);                           // encode as (utf-8) Uint8Array
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8);             // hash the message
  const hashArray = Array.from(new Uint8Array(hashBuffer));                     // convert buffer to byte array
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
  return hashHex;
}

// anonymize all components of a hostname except for the public suffixes
// (as found in the Public Suffix List) and {isi,usc}.edu.
//
// example: a.b.c.usc.edu   -> xxxx.yyyy.zzzz.usc.edu
// example: www.mozilla.org -> xxxx.yyyy.org
async function anonymizeHostname(hostname) {
  // it's OK for our purposes that the salt is well-known and reused
  let salt          = "Cv$xlqps44>GA;ZlQvG0-8%4c";
  let anon_hostname = "";

  // convert hostname (utf) to hostname (punycode/ascii)
  //console.log("original", hostname);
  hostname = punycode.toASCII(hostname);
  //console.log("puny", hostname);

  // break down the host into its components and public suffix
  // example: "a.b.c.usc.edu" -> ["a.b.c.", "usc.edu"]
  let public_suffix = window.publicSuffixList.getPublicSuffix(hostname);
  let components = (hostname.slice(0, -1*public_suffix.length)).split(".");
  components.length--; // remove extra empty element

  // hash each component of the hostname
  // example: ["a.b.c."] -> ["xxxx", "yyyy", "zzzz"]
  let anon_components = new Array();
  for(const c of components) {
    anon_components.push(await digestMessage(salt + c));
  }

  // add to the end the public suffix (.com, .co.uk, ...)
  // example: ["xxxx", "yyyy", "zzzz", "usc.edu"]
  anon_components.push(public_suffix);

  // rebuild our now anoymized hostname
  // example: "xxxx.yyyy.zzzz.usc.edu"
  anon_hostname = anon_components.join('.');

  return anon_hostname;
}

// load public suffix list
window.publicSuffixList.parse(psl.list.replace(/,/g, "\n"), punycode.toASCII);

const query = {
  'text'      : "http", /* this gets http : // and https : // */
  'startTime' : experiment.start.getTime(),
  'endTime'   : experiment.end.getTime(),
  'maxResults': 1000000
};

let history = browser.history.search(query);
let collection = new Array();

history.then( async (items) => {
  //console.debug("history:", items);

  let hostnames  = new Set();

  //for (const item of items) {
  //await items.forEach(async function(item, index) {

  // parallelize this operation
  await Promise.all(items.map(async (item) => {
    //console.log("processing", item);

    // item should (have a url) and (not be an IPv{4,6} address)
    //if(!item.url) { continue; }
    if(!item.url) { return; }
    let url = new URL(item.url);

    //if( (url.hostname).match(psl.ip_regexp) ) { continue; }
    if( (url.hostname).match(psl.ip_regexp) ) { return; }

    // if an item doesn't have a title, we probably got a 301 redirect
    //if(item.title == "") { continue; }
    if(item.title == "") { return; }

    // build and anonymize components
    let hostname      = url.hostname;
    let anon_hostname = await anonymizeHostname(hostname);

    if (hostnames.has(anon_hostname)) {
      return;
    } else {
      hostnames.add(anon_hostname);
    }

    // each history item might have multiple visits
    let timestamps    = new Array();
    if(item.visitCount > 1) {
      /* add one timestamp only --- our submission process chokes if
       * there are too many entries */
      let visits = await browser.history.getVisits({url: item.url});
      for(const visit of visits) {
        timestamps.push(visit.visitTime);
      }//*/
      //timestamps.push(item.lastVisitTime);
    } else {
      timestamps.push(item.lastVisitTime);
    }

    for(const timestamp of timestamps) {
      // for each entry, add a row to the table (timestamp, raw, encoded)
      let ts       = new Date(timestamp);
      let tbody    = document.querySelector('#history tbody');
      let template = document.querySelector('#history-row');
      let clone    = document.importNode(template.content, true);
      let td       = clone.querySelectorAll("td");

      td[0].textContent = ts.toJSON();
      td[1].textContent = hostname;
      td[3].textContent = anon_hostname;

      tbody.appendChild(clone);

      // add entry (timestamp, anonymized hostname) to array
      //collection.push({t: ts.toJSON(), h: anon_hostname});
      collection.push([ts.toJSON(), anon_hostname]);
    }
  }));

  console.log(collection.length);

  // generate json for output
  let output = document.querySelector('#output');
  output.textContent = JSON.stringify(collection);

  //document.getElementById("numEntries").textContent = collection.length;
  // done
});

/* UI elements */

// button: copy snippet text to clipboard
document.getElementById("copy").addEventListener("click", function() {
  var text = document.getElementById("output");
  text.focus();
  text.select();
  document.execCommand("copy");
});

// button, link: open pre-filled google forms link
function openSubmissionForm() {
  var text = document.getElementById("output");
  var submission = text.textContent;

  var url = "https://docs.google.com/forms/d/e/1FAIpQLSfXxqzWBVca8jjTHEYtO9yA7wp1zx2Xi-Z_3Od_wuVLlBTRYg/viewform"

  // a pre-filled form would be nice, but the URL can get kind of large
  // and return 421 errors. so unfortunately we'll need to have them
  // copy & paste the snippet to the form (or via email if it's too
  // large). ~300 anonymized hostnames is OK, but ~500 is too large.

  // attempted to do something clever, depending on how large the
  // snippet is, but this won't work.
  /*if(collection.length > 0 && collection.length < 300) {
    url = "https://docs.google.com/forms/d/e/1FAIpQLSfXxqzWBVca8jjTHEYtO9yA7wp1zx2Xi-Z_3Od_wuVLlBTRYg/viewform?usp=pp_url&entry.1876093562=";
    url += submission;
    console.log(url);
  }*/
  window.open(url);
}

function saveSnippet() {
  var text = document.getElementById("output");
  var submission = text.textContent;

  var blob = new Blob([submission], {type: "application/json;charset=utf-8"});
  saveAs(blob, "anonymized-browser-history.json");
}

document.getElementById("button-submit").addEventListener("click", openSubmissionForm);
//document.getElementById("link-submit").addEventListener("click", openSubmissionForm);

document.getElementById("button-download").addEventListener("click", saveSnippet);

// span: dates
var options = { year: 'numeric', month: 'long', day: 'numeric' };
document.getElementById("today").textContent     = (new Date()).toLocaleDateString("en-US", options);
document.getElementById("endDate").textContent   = (experiment.end).toLocaleDateString("en-US", options);
document.getElementById("exp-start").textContent = (experiment.start).toLocaleDateString("en-US", options);
document.getElementById("exp-end").textContent   = (experiment.end).toLocaleDateString("en-US", options);

// span: display version number
document.getElementById('version')
        .insertAdjacentText('afterbegin', browser.runtime.getManifest().version);

})();
