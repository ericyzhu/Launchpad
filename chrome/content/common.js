/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

'use strict';

const
{
	classes     : Cc,
	Constructor : CC,
	interfaces  : Ci,
	utils       : Cu,
	results     : Cr,
	manager     : Cm
} = Components;

let {Services, atob, btoa} = Cu.import('resource://gre/modules/Services.jsm');

let addonData = function()
{
	let result = {};
	result.wrappedJSObject = result;
	Services.obs.notifyObservers(result, 'launchpad-mozest-org:addonData', null);
	return result.exports;
}();

function require(aMmodule)
{
	let result = {};
	result.wrappedJSObject = result;
	Services.obs.notifyObservers(result, 'launchpad-mozest-org:require', aMmodule);
	return result.exports;
}


function getStyle(aElement, aPropertyName, aPseudoElt)
{
	let style = parseFloat(window.getComputedStyle(aElement, aPseudoElt ? aPseudoElt : null).getPropertyValue(aPropertyName));

	return isNaN(style) ? 0 : style;
}

function getElementDimensions(aElement)
{
	let {offsetWidth, offsetHeight} = aElement;
	let {scrollWidth, scrollHeight} = aElement;
	let borderLeftWidth   = getStyle(aElement, 'border-left-width');
	let borderRightWidth  = getStyle(aElement, 'border-right-width');
	let borderTopWidth    = getStyle(aElement, 'border-top-width');
	let borderBottomWidth = getStyle(aElement, 'border-bottom-width');
	let paddingLeft       = getStyle(aElement, 'padding-left');
	let paddingRight      = getStyle(aElement, 'padding-right');
	let paddingTop        = getStyle(aElement, 'padding-top');
	let paddingBottom     = getStyle(aElement, 'padding-bottom');
	let marginLeft        = getStyle(aElement, 'margin-left');
	let marginRight       = getStyle(aElement, 'margin-right');
	let marginTop         = getStyle(aElement, 'margin-top');
	let marginBottom      = getStyle(aElement, 'margin-bottom');

	return {
		width  : offsetWidth  - borderLeftWidth - borderRightWidth  - paddingLeft - paddingRight,
		height : offsetHeight - borderTopWidth  - borderBottomWidth - paddingTop  - paddingBottom,
		offsetWidth       : offsetWidth,
		offsetHeight      : offsetHeight,
		scrollWidth       : scrollWidth,
		scrollHeight      : scrollHeight,
		borderLeftWidth   : borderLeftWidth,
		borderRightWidth  : borderRightWidth,
		borderTopWidth    : borderTopWidth,
		borderBottomWidth : borderBottomWidth,
		paddingLeft       : paddingLeft,
		paddingRight      : paddingRight,
		paddingTop        : paddingTop,
		paddingBottom     : paddingBottom,
		marginLeft        : marginLeft,
		marginRight       : marginRight,
		marginTop         : marginTop,
		marginBottom      : marginBottom
	};
}

function removeElementChildren(aElement)
{
	while (aElement.firstChild)
	{
		aElement.removeChild(aElement.firstChild);
	}
}

function isInt(aValue)
{
	return typeof aValue === 'number' && aValue % 1 == 0;
}

let mainWindow = window.QueryInterface(Ci.nsIInterfaceRequestor)
	.getInterface(Ci.nsIWebNavigation)
	.QueryInterface(Ci.nsIDocShellTreeItem)
	.rootTreeItem
	.QueryInterface(Ci.nsIInterfaceRequestor)
	.getInterface(Ci.nsIDOMWindow);
