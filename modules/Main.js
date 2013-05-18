/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 **/

'use strict';

Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');

let {WindowObserver} = require('WindowObserver');
let {FileUtils} = require('FileUtils');
let {BookmarkUtils} = require('BookmarkUtils');
let {Prefs, PrefListener} = require('Prefs');
let {Storage} = require('Storage');
let {KeysMap : {KEYCODES, MODIFIERS}} = require('KeysMap');
let {Localization} = require('Localization');
let locale = Localization.getBundle('locale');
let {id : ADDON_ID, STARTUP_REASON, OPTIONS_WIN_URI, OPTIONS_WIN_TYPE, MAIN_WIN_URI, SKIN_DIR_URI, PACKAGE_NAME} = addonData;
let styleSheetService = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
let styleSheetURI = Services.io.newURI(SKIN_DIR_URI + 'browser.css', null, null)
let alertsService = Cc['@mozilla.org/alerts-service;1'].getService(Ci.nsIAlertsService);
let alertIcon = SKIN_DIR_URI + 'icons/logo.png';

function elementSelector(aDocument, aID, aQueryAll)
{
	return aDocument[aQueryAll ? 'querySelectorAll' : 'getElementById'](aID);
}

function setButtonPosition(aDocument, aButton)
{
	let toolbars = elementSelector(aDocument, 'toolbar', true);
	let toolbar, currentset, index;

	for (let i = 0; i < toolbars.length; i++)
	{
		currentset = toolbars[i].getAttribute('currentset').split(',');
		index = currentset.indexOf(aButton.id);
		if (index >= 0)
		{
			toolbar = toolbars[i];
			break;
		}
	}

	if ( ! toolbar && Prefs.toolbarButtonPosition)
	{
		let [toolbarID, beforeID] = Prefs.toolbarButtonPosition;
		toolbar = elementSelector(aDocument, toolbarID);
		if (toolbar)
		{
			currentset = toolbar.getAttribute('currentset').split(',');
			index = (beforeID && currentset.indexOf(beforeID)) || -1;

			if (index >= 0)
			{
				currentset.splice(index, 0, aButton.id);
			}
			else
			{
				currentset.push(aButton.id);
			}

			toolbar.setAttribute('currentset', currentset.join(','));
			aDocument.persist(toolbarID, 'currentset');
		}
	}

	if (toolbar)
	{
		if (index >= 0)
		{
			for (let i = index + 1; i < currentset.length; i++)
			{
				let before = elementSelector(aDocument, currentset[i]);
				if (before)
				{
					toolbar.insertItem(aButton.id, before);
					break;
				}
			}
		}
		else
		{
			toolbar.insertItem(aButton.id);

		}
	}
}

function removeButton(aDocument, aButton)
{
	let toolbars = elementSelector(aDocument, 'toolbar', true);
	let buttonPosition = null;

	for (let i = 0; i < toolbars.length; i++)
	{
		let currentset = toolbars[i].getAttribute('currentset').split(',');
		let index = currentset.indexOf(aButton.id);
		if (index >= 0)
		{
			buttonPosition = [toolbars[i].id, currentset[index + 1]];
			break;
		}
	}

	Prefs.toolbarButtonPosition = buttonPosition;
	aButton.parentNode.removeChild(aButton);
}

Storage.openConnection(FileUtils.getDataFile(['database.sqlite'], true),
{
	onSuccess : function(aConnection)
	{
		function initTable(aName, aSchema)
		{
			aConnection.tableExists(aName,
			{
				onResult : function(aExists)
				{
					if ( ! aExists)
					{
						aConnection.createTable(aName, aSchema,
						{
							onError : function(aError)
							{
								Cu.reportError(aError);
							}
						});
					}
				},
				onError : function(aError)
				{
					Cu.reportError(aError);
				}
			});
		}
		initTable('bookmarkSnapshots', 'leafName VARCHAR(32) PRIMARY KEY, mimeType VARCHAR(32), URI TEXT, title TEXT, lastModified INTEGER, expires INTEGER, reload INTEGER, CONSTRAINT leafName UNIQUE (leafName) ON CONFLICT REPLACE');
		initTable('logs', 'id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT, created INTEGER');
	},
	onError : function(aError)
	{
		Cu.reportError(aError);
	}
});

WindowObserver.addListener('navigator:browser', 'load', function(aWindow)
{
	if (Prefs.firstrun == true)
	{
		Prefs.firstrun = false;
		aWindow.openDialog(OPTIONS_WIN_URI, OPTIONS_WIN_TYPE, 'chrome,titlebar,centerscreen,dialog=yes');
	}

	let styleSheet =
	{
		_isRegistered : function()
		{
			return styleSheetService.sheetRegistered(styleSheetURI, styleSheetService.USER_SHEET);
		},
		init : function()
		{
			if ( ! this._isRegistered())
			{
				styleSheetService.loadAndRegisterSheet(styleSheetURI, styleSheetService.USER_SHEET);
			}

			return this;
		},
		uninit : function()
		{
			if (this._isRegistered())
			{
				styleSheetService.unregisterSheet(styleSheetURI, styleSheetService.USER_SHEET);
			}
		}
	}.init();

	let gBrowser = aWindow.getBrowser();
	let document = aWindow.document;
	let mainWindow = document.getElementById('main-window');

	// add button to toolbar
	let button = document.createElement('toolbarbutton');
	button.setAttribute('id', PACKAGE_NAME + '-toolbar-button');
	button.setAttribute('label', locale.toolbarButtonLabel);
	button.setAttribute('tooltiptext', locale.toolbarButtonTooltip);
	button.setAttribute('oncommand', 'ToggleLaunchpadWindow();');
	button.classList.add('toolbarbutton-1');
	button.classList.add('chromeclass-toolbar-additional');
	elementSelector(document, 'navigator-toolbox').palette.appendChild(button);
	setButtonPosition(document, button);

	// create launchpad window
	let launchpadWindow =
	{
		window : null,
		browser : null,
		mainWindowContent : null,
		resize : null,
		_open : function()
		{
			this.resize();
			! this.window.classList.contains('open') && this.window.classList.add('open');
			this.browser.focus();
			if (aWindow.gURLBar.value == '')
			{
				aWindow.gURLBar.focus();
				aWindow.gURLBar.select();
			}
		},
		_close : function()
		{
			this.window.classList.contains('open') && this.window.classList.remove('open');
			this.browser.blur();
			aWindow.gURLBar.blur();
		},
		toggle : function(aState)
		{
			let windowState = false;

			if (typeof(aState) == 'undefined')
			{
				let {selectedTab, selectedBrowser : {contentWindow}} = gBrowser;
				if (contentWindow.location.href == 'about:blank' && contentWindow.document.readyState == 'complete' &&
				    ! selectedTab.hasAttribute('pending') && selectedTab.__launchpadFlagLoaded__)
				{
					if (this.window.classList.contains('open')) return;

					windowState = true;
				}
				else
				{
					windowState = this.window.classList.contains('open') ? false : true;
				}
			}
			else
			{
				windowState = aState == true;
			}

			if (windowState)
			{
				this._open();
			}
			else
			{
				this._close();
			}
		},
		init : function()
		{
			this.mainWindowContent = document.getElementById('content');

			this.window = document.createElement('box');
			this.window.setAttribute('id', PACKAGE_NAME + '-window');

			this.browser = document.createElement('browser');
			this.browser.setAttribute('id', PACKAGE_NAME + '-browser');
			this.browser.setAttribute('type', 'content');
			this.browser.setAttribute('disablehistory', true);
			this.browser.setAttribute('transparent', 'transparent');
			this.browser.setAttribute('src', MAIN_WIN_URI);

			this.window.appendChild(this.browser);
			this.mainWindowContent.appendChild(this.window);

			let hiddenWindow = document.createElement('box');
			hiddenWindow.setAttribute('id', PACKAGE_NAME + '-hidden-window');
			this.mainWindowContent.appendChild(hiddenWindow);

			this.resize = function()
			{
				let {x, y, width, height} = this.mainWindowContent.boxObject;

				this.browser.style.width   = width + 'px';
				this.browser.style.height  = height + 'px';
				this.window.style.width    = width + 'px';
				this.window.style.height   = height + 'px';
				this.window.style.top      = y + 'px';
				this.window.style.left     = x + 'px';
			}.bind(this);

			this.resize();
			aWindow.addEventListener('resize', this.resize, false);
			aWindow.ToggleLaunchpadWindow = this.toggle.bind(this);
			aWindow.AddPageToLaunchpad = function()
			{
				try
				{
					let window = gBrowser.selectedBrowser.contentWindow;
					let bookmark =
					{
						uri      : window.location.href,
						title    : window.document.title,
						type     : BookmarkUtils.TYPE_BOOKMARK,
						index    : BookmarkUtils.DEFAULT_INDEX,
						folderID : Prefs.bookmarksFolderID
					};
					BookmarkUtils.addBookmark(bookmark, function()
					{
						try
						{
							alertsService.showAlertNotification(alertIcon,
								subString(bookmark.title != '' ? bookmark.title : bookmark.uri, 48),
								locale.pageAddedNotification,
								false, '', null, 'Firefox Extenstion Notification: Launchpad'
							);
						} catch (e) {}

					});
				} catch (e) {}
			};

			return this;
		},
		uninit : function()
		{
			aWindow.removeEventListener('resize', this.resize, false);
			delete aWindow.ToggleLaunchpadWindow;
			delete aWindow.AddPageToLaunchpad;
			this.window.parentNode.removeChild(this.window);
			this.resize = null;
		}
	}.init();

	let pageLoadListener =
	{
		appcontent : null,
		onPageLoad : function(aEvent)
		{
			let {URL, defaultView} =  aEvent.originalTarget;
			let {selectedTab, selectedBrowser} = gBrowser;
			if (URL == 'about:blank' && defaultView == selectedBrowser.contentWindow && ! selectedTab.hasAttribute('pending'))
			{
				selectedTab.__launchpadFlagLoaded__ = true;
				launchpadWindow.toggle(true);
			}
		},
		init : function()
		{
			this.appcontent = document.getElementById('appcontent');
			this.appcontent && this.appcontent.addEventListener('DOMContentLoaded', this.onPageLoad, true);

			return this;
		},
		uninit : function()
		{
			this.appcontent && this.appcontent.removeEventListener('DOMContentLoaded', this.onPageLoad, true);
			this.appcontent = null;
		}
	}.init();

	// progress listener
	let progressListener =
	{
		QueryInterface : XPCOMUtils.generateQI(['nsIWebProgressListener', 'nsISupportsWeakReference']),
		pending : null,
		loadingURI : null,
		onLocationChange : function(aProgress, aRequest, aURI)
		{
			let DOMWindow = aProgress.DOMWindow;

			if (aURI.spec == 'about:blank' && DOMWindow.document.readyState == 'complete' && ! gBrowser.selectedTab.hasAttribute('pending') && gBrowser.selectedTab.__launchpadFlagLoaded__)
			{
				launchpadWindow.toggle(true);
			}
			else
			{
				launchpadWindow.toggle(false);
			}
		},
		onStateChange : function() {},
		onProgressChange : function() {},
		onStatusChange : function() {},
		onSecurityChange : function() {},

		init : function()
		{
			gBrowser.addProgressListener(this);

			if (gBrowser.tabs.length < 2)
			{
				let DOMWindow = gBrowser.tabs[0].linkedBrowser.contentWindow;
				let readyState = DOMWindow.document.readyState;

				if (DOMWindow.location.href == 'about:blank' && readyState == 'complete')
				{
					launchpadWindow.toggle(true);
				}
			}

			return this;
		},
		uninit : function()
		{
			gBrowser.removeProgressListener(this);
		}
	}.init();

	let contextMenu =
	{
		menuitems : null,
		init : function()
		{
			this.menuitems = [];

			let menuitem;
			menuitem = document.createElement('menuitem');
			menuitem.setAttribute('id', PACKAGE_NAME + '-context-add-to-launchpad');
			menuitem.setAttribute('oncommand', 'AddPageToLaunchpad();');
			menuitem.setAttribute('label', locale.addThisPageToLaunchpad);

			this.menuitems.push(menuitem);
			document.getElementById('contentAreaContextMenu').insertBefore(menuitem, document.getElementById('context-bookmarkpage'));

			return this;
		},
		uninit : function()
		{
			for (let i = 0; i < this.menuitems.length; i++)
			{
				let menuitem = this.menuitems[i];
				menuitem.parentNode.removeChild(menuitem);
			}
			this.menuitems = null;
		}
	}.init();

	// create keyset
	let keyset =
	{
		keysets : null,
		_listener : null,
		init : function()
		{
			let openLaunchdShortcutKeyset, addPageToLaunchpadShortcutKeyset;
			openLaunchdShortcutKeyset = new createKeyset('openLaunchdShortcut', 'ToggleLaunchpadWindow');
			addPageToLaunchpadShortcutKeyset = new createKeyset('addPageToLaunchpadShortcut', 'AddPageToLaunchpad');
			this.keysets = [openLaunchdShortcutKeyset, addPageToLaunchpadShortcutKeyset];

			this._listener = function(aName)
			{
				switch (aName)
				{
					case 'openLaunchdShortcut':
						openLaunchdShortcutKeyset.reset();
						break;

					case 'addPageToLaunchpadShortcut':
						addPageToLaunchpadShortcutKeyset.reset();
						break;
				}
			};

			PrefListener.add(this._listener);

			function createKeyset(aPrefName, aCommand)
			{
				let prefName, keyset;
				prefName = aPrefName;
				this.remove = function()
				{
					try
					{
						keyset.parentNode.removeChild(keyset);
					} catch (e) {}
				};
				this.reset = function()
				{
					let keyModifiers = [];
					let keyKeycode = '';
					let {modifiers, keycode} = Prefs[prefName];
					modifiers = modifiers
						? (Array.isArray(modifiers) ? modifiers : [])
						: [];

					keycode = keycode
						? parseInt(keycode)
						: 0;

					for (let i = 0; i < modifiers.length; i++)
					{
						let [keyName] = MODIFIERS[modifiers[i]];
						keyModifiers.push(keyName);
					}

					if (keycode && KEYCODES[keycode])
					{
						let [constantString] = KEYCODES[keycode];
						keyKeycode = constantString;
					}

					this.remove();

					keyset = document.createElement('keyset');
					let key = document.createElement('key');
					key.setAttribute('id', PACKAGE_NAME + '-' + prefName);
					key.setAttribute('oncommand', aCommand + '();');
					key.setAttribute('modifiers', keyModifiers.join(','));
					key.setAttribute('keycode', keyKeycode);
					keyset.appendChild(key);
					mainWindow.appendChild(keyset);
				};
				this.reset();
				return this;
			}

			return this;
		},
		uninit : function()
		{
			PrefListener.remove(this._listener);
			try
			{
				for (let i = 0; i < this.keysets.length; i++)
				{
					this.keysets[i].remove();
				}
				this.keysets = null;
			} catch (e) {}
			this._listener = null;
		}
	}.init();

	function shutdownHandler()
	{
		removeButton(document, button);
		pageLoadListener.uninit();
		keyset.uninit();
		contextMenu.uninit();
		progressListener.uninit();
		launchpadWindow.uninit();
		styleSheet.uninit();
		aWindow.removeEventListener('unload', onUnload);
	}

	function onUnload()
	{
		pageLoadListener.uninit();
		keyset.uninit();
		contextMenu.uninit();
		progressListener.uninit();
		launchpadWindow.uninit();
		onShutdown.remove(shutdownHandler);
	}

	onShutdown.add(shutdownHandler);

	aWindow.addEventListener('unload', onUnload, false);
});

function subString(aString, aLength)
{
	let pattern = /[^\x00-\xff]/g;
	let length = aString.replace(pattern, '**').length;

	let output = '';
	let char;
	let tempLength = 0;
	for (let i = 0; i < aString.length; i++)
	{
		char = aString.charAt(i).toString();
		if (char.match(pattern) == null) tempLength++;
		else tempLength += 2;
		if (tempLength > aLength) break;
		output += char;
	}
	if (length > aLength) output += '...';

	return output;
}
