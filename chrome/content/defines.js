/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

'use strict';

let {Prefs, PrefListener} = require('Prefs');
let {Localization} = require('Localization');
let {BookmarkUtils} = require('BookmarkUtils');
let {Utils} = require('Utils');
let {Thumbnail} = require('Thumbnail');
let {FileUtils} = require('FileUtils');
//let {Storage : {connection : Storage}} = require('Storage');

let locale = Localization.getBundle('locale');

// WINNT | Linux | Darwin
const OS = Services.appinfo.OS;

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const SCROLLBOX_ID = 'scrollbox';
const CONTAINER_ID = 'container';
const DIALPAD_ID = 'dialpad';
const DIALPAD_ADD_BUTTON_ID = 'dialpad-add-button';
const DIALPAD_BUTTON_ID_PREFIX = 'dialpad-button-';
const DIALPAD_BUTTON_BACKGROUND_CLASS = 'dialpad-button-background';
const DIALPAD_BUTTON_CONTAINER_CLASS = 'dialpad-button-container';
const DIALPAD_BUTTON_LINK_CLASS = 'dialpad-button-link';
const DIALPAD_BUTTON_THUMBNAIL_CLASS = 'dialpad-button-thumbnail';
const DIALPAD_BUTTON_TITLE_CLASS = 'dialpad-button-title';
const DIALPAD_BUTTON_REMOVE_BUTTON_CLASS = 'dialpad-button-remove-button';
const DIALPAD_BUTTON_LOADING_CLASS = 'dialpad-button-loading';
const SUPPORTED_DATATRANSFER_DATA_TYPES = ['text/x-moz-url', 'text/x-moz-text-internal'];

let scrollbox, container;
let Launchpad = {};

scrollbox = document.getElementById(SCROLLBOX_ID);
container = document.getElementById(CONTAINER_ID);

