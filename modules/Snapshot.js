/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 **/

'use strict';

let {Services, atob, btoa} = Cu.import('resource://gre/modules/Services.jsm', null);

let HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
let queue = [];

exports.Snapshot =
{
	get STATUS_SUCCESS()  0,
	get STATUS_TIMEOUT()  1,
	get DEFAULT_WIDTH()   1280,
	get DEFAULT_HEIGHT()  800,
	get BOOKMARK_WIDTH()  512,
	get BOOKMARK_HEIGHT() 320,
	get CAPTURE_DELAY()   2 * 1000,
	get CAPTURE_TIMEOUT() 30 * 1000,
	get CONTENT_TYPE()    'image/png',

	getScreenSize : function()
	{
		let screenManager = Cc['@mozilla.org/gfx/screenmanager;1'].getService(Ci.nsIScreenManager);
		let left = {}, top = {}, width = {}, height = {};
		screenManager.primaryScreen.GetRect(left, top, width, height);
		return [width.value, height.value];
	},

	getScrollbarSize : function(aWindow)
	{
		let utils = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
		let width = {}, height = {};

		try
		{
			utils.getScrollbarSize(false, width, height);
		}
		catch (e)
		{
			width.value = height.value = 0;
		}

		return [width.value, height.value];
	},

	getPageSize : function(aWindow)
	{
		function getElementSizeByTagName(aTagName)
		{
			try
			{
				let computedStyle = aWindow.getComputedStyle(aWindow.document.getElementsByTagName(aTagName)[0], null);
				return [
					parseInt(computedStyle.getPropertyValue('width')),
					parseInt(computedStyle.getPropertyValue('height')),
					parseInt(computedStyle.getPropertyValue('min-width')),
					parseInt(computedStyle.getPropertyValue('min-height'))
				];
			}
			catch (e)
			{
				return [0, 0, 0, 0];
			}

		}

		let width, height;
		let [htmlWidth, htmlHeight, htmlMinWidth, htmlMinHeight] = getElementSizeByTagName('html');
		let [bodyWidth, bodyHeight, bodyMinWidth, bodyMinHeight] = getElementSizeByTagName('body');

		if (bodyMinWidth)
		{
			width = bodyMinWidth;
		}
		else if (htmlMinWidth)
		{
			width = htmlMinWidth;
		}
		else
		{
			width = bodyWidth;
		}

		if (bodyMinHeight)
		{
			height = bodyMinHeight;
		}
		else if (htmlMinHeight)
		{
			height = htmlMinHeight;
		}
		else
		{
			height = bodyHeight;
		}

		if ( ! width || ! height)
		{
			width = this.DEFAULT_WIDTH;
			height = this.DEFAULT_HEIGHT;
		}

		return [width, height];
	},

	captureForBookmark : function(aURI, aCallback)
	{
		for (let i = 0; i < queue.length; i++)
		{
			let [uri, callbacks] = queue[i];
			if (uri == aURI)
			{
				if (callbacks.indexOf(aCallback) < 0)
				{
					queue[i][1].push(aCallback)
				}
				return;
			}
		}

		if (queue.length > 0)
		{
			queue.push([aURI, [aCallback]]);
			return;
		}

		let capture = function capture()
		{
			let browserWindow = Services.wm.getMostRecentWindow("navigator:browser").QueryInterface(Ci.nsIDOMWindow);
			let browserDocument = browserWindow.document;
			let mainWindow = browserDocument.getElementById('main-window');
			let hiddenWindow = browserDocument.getElementById('launchpad-mozest-org-hidden-window');

			let [uri, callbacks] = queue[0];
			let timer;
			let browser = browserDocument.createElement('browser');
			browser.style.width = this.DEFAULT_WIDTH + 'px';
			browser.style.height = this.DEFAULT_HEIGHT + 'px';
			browser.style.overflow = 'hidden';
			browser.setAttribute('type', 'content');
			browser.setAttribute('disablehistory', true);
			hiddenWindow.appendChild(browser);

			let continueQueue = function()
			{
				(queue.length > 0) && browserWindow.setTimeout(function()
				{
					capture.bind(this)();
				}.bind(this), 1000);
			}.bind(this);

			let cleanAndContinue = function()
			{
				browser.removeEventListener('load', onload, true);
				browser.parentNode && browser.parentNode.removeChild(browser);
				queue.splice(0, 1);
				continueQueue();
			}.bind(this);

			let stopTimer = function()
			{
				if (timer)
				{
					browserWindow.clearTimeout(timer);
				}
			}

			let onload = function onload()
			{
				stopTimer();

				let window = browser.contentWindow;
				let [pageWidth, pageHeight] = this.getPageSize(window);
				let [sbWidth, sbHeight] = this.getScrollbarSize(window);

				pageWidth = pageWidth < this.DEFAULT_WIDTH ? this.DEFAULT_WIDTH : pageWidth;
				pageHeight = pageHeight < this.DEFAULT_HEIGHT ? this.DEFAULT_HEIGHT : pageHeight;

				let width = pageWidth + sbWidth;
				let height = pageHeight + sbHeight;

				browser.style.width = width + 'px';
				browser.style.height = height + 'px';

				let canvas = window.document.createElementNS(HTML_NAMESPACE, 'canvas');

				if (window.devicePixelRatio == 2)
				{
					canvas.width = this.BOOKMARK_WIDTH * 2;
					canvas.height = this.BOOKMARK_HEIGHT * 2;
				}
				else
				{
					canvas.width = this.BOOKMARK_WIDTH;
					canvas.height = this.BOOKMARK_HEIGHT;
				}

				window.setTimeout(function ()
				{
					for (let i = 0; i < callbacks.length; i++)
					{
						callbacks[i](this.STATUS_SUCCESS, this.captureToCanvas(window, canvas), window.document.title);
					}
					cleanAndContinue();
				}.bind(this), this.CAPTURE_DELAY);

			}.bind(this);

			browser.addEventListener('load', onload, true);
			browser.setAttribute('src', uri);

			timer = browserWindow.setTimeout(function()
			{
				stopTimer();
				for (let i = 0; i < callbacks.length; i++)
				{
					callbacks[i](this.STATUS_TIMEOUT, 'Capture timeout.');
				}
				cleanAndContinue();
			}.bind(this), this.CAPTURE_TIMEOUT);
		}.bind(this);

		queue.push([aURI, [aCallback]]);
		capture();
	},

	captureToCanvas : function(aWindow, aCanvas)
	{
		let [sw, sh, scale] = this.determineCropSize(aWindow, aCanvas);
		let context = aCanvas.getContext('2d');
		context.clearRect(0, 0, sw, sh);
		context.save();
		context.scale(scale, scale);
		try
		{
			context.drawWindow(aWindow, 0, 0, sw, sh, 'rgba(0,0,0,0)');
		}
		catch (e) {}
		context.restore();

		let dataURL = aCanvas.toDataURL(this.CONTENT_TYPE);
		let pattern = new RegExp('data:' + this.CONTENT_TYPE + ';base64,');

		return atob(dataURL.replace(pattern, ''));
	},

	determineCropSize : function(aWindow, aCanvas)
	{
		let [sbWidth, sbHeight] = this.getScrollbarSize(aWindow);

		let sw = aWindow.innerWidth - sbWidth;
		let sh = aWindow.innerHeight - sbHeight;

		let {width: thumbnailWidth, height: thumbnailHeight} = aCanvas;
		let scale = Math.min(Math.max(thumbnailWidth / sw, thumbnailHeight / sh), 1);
		let scaledWidth = sw * scale;
		let scaledHeight = sh * scale;

		if (scaledHeight > thumbnailHeight)
		{
			sh -= Math.floor(Math.abs(scaledHeight - thumbnailHeight) * scale);
		}

		if (scaledWidth > thumbnailWidth)
		{
			sw -= Math.floor(Math.abs(scaledWidth - thumbnailWidth) * scale);
		}

		return [sw, sh, scale];
	}
}
