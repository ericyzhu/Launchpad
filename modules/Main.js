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
let {Prefs, PrefListener} = require('Prefs');
let {Storage} = require('Storage');
let {KeysMap : {KEYCODES, MODIFIERS}} = require('KeysMap');
let {Localization} = require('Localization');
let locale = Localization.getBundle('locale');
let {id : ADDON_ID, STARTUP_REASON, OPTIONS_WIN_URI, OPTIONS_WIN_TYPE, MAIN_WIN_URI, SKIN_DIR_URI} = addonData;
let styleSheetService = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
let styleSheetURI = Services.io.newURI(SKIN_DIR_URI + 'browser.css', null, null)

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
	button.setAttribute('id', 'launchpad-mozest-org-toolbar-button');
	button.setAttribute('label', locale.toolbarButtonLabel);
	button.setAttribute('tooltiptext', locale.toolbarButtonTooltip);
	button.setAttribute('oncommand', 'ToggleLaunchpadWindow();');
	button.setAttribute('onclick', 'checkForMiddleClick(this, event);');
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
		windowStage : null,
		isBlankPage : null,
		resize : null,
		_open : function()
		{
			this.resize();
			this.window.classList.add('open');

			if (aWindow.gURLBar.value == '')
			{
				aWindow.gURLBar.focus();
				aWindow.gURLBar.select();
			}
		},
		_close : function()
		{
			this.window.classList.remove('open');
			aWindow.gURLBar.blur();
		},
		toggle : function(aStage, aIsBlankPage)
		{
			if (typeof(aIsBlankPage) != 'undefined')
			{
				this.isBlankPage = aIsBlankPage == true;
			}

			if (typeof(aStage) != 'undefined')
			{
				this.windowStage = aStage == true;
			}
			else
			{
				this.windowStage = this.windowStage ? false : true;
			}

			if (this.isBlankPage)
			{
				this.windowStage = true;
			}

			if (this.windowStage)
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

			this.window = document.createElement('vbox');
			this.window.setAttribute('id', 'launchpad-mozest-org-window');

			this.browser = document.createElement('browser');
			this.browser.setAttribute('id', 'launchpad-mozest-org-browser');
			this.browser.setAttribute('type', 'content');
			this.browser.setAttribute('disablehistory', true);
			this.browser.setAttribute('transparent', 'transparent');
			this.browser.setAttribute('src', MAIN_WIN_URI);

			this.window.appendChild(this.browser);
			this.mainWindowContent.appendChild(this.window);

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

			return this;
		},
		uninit : function()
		{
			aWindow.removeEventListener('resize', this.resize, false);
			delete aWindow.ToggleLaunchpadWindow;
			this.window.parentNode.removeChild(this.window);
			this.resize = null;
		}
	}.init();

	// create context menu
	let launchpadPopupset =
	{
		popupset : null,
		init : function()
		{
			this.popupset = document.createElement('popupset');

			let popup = document.createElement('menupopup');
			popup.setAttribute('id', 'launchpad-edit-menu');
			popup.setAttribute('oncommand', 'LaunchpadContextmenuCommand(event, event.target.id, this.oID);');
			this.popupset.appendChild(popup);

			let _edit = document.createElement('menuitem');
			_edit.setAttribute('id', 'launchpad-edit-menu-edit');
			_edit.setAttribute('label', locale.edit);
			popup.appendChild(_edit);

			popup.appendChild(document.createElement('menuseparator'));

			let _reload = document.createElement('menuitem');
			_reload.setAttribute('id', 'launchpad-edit-menu-reload');
			_reload.setAttribute('label', locale.reload);
			popup.appendChild(_reload);

			popup.appendChild(document.createElement('menuseparator'));

			let _remove = document.createElement('menuitem');
			_remove.setAttribute('id', 'launchpad-edit-menu-remove');
			_remove.setAttribute('label', locale.remove);
			popup.appendChild(_remove);


			document.getElementById('main-window').appendChild(this.popupset);

			aWindow.LaunchpadContextmenuCommand = function(aEvent, aMenuID, aOID)
			{
				try
				{
					launchpadWindow.browser.contentWindow.Launchpad.button.contextmenuCommand(aEvent, aMenuID, aOID);
				} catch (e) {};
			};

			return this;
		},
		uninit : function()
		{
			delete aWindow.LaunchpadContextmenuCommand;
			this.popupset.parentNode.removeChild(this.popupset);
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

			if (DOMWindow == gBrowser.selectedTab.linkedBrowser.contentWindow)
			{
				let readyState = DOMWindow.document.readyState;
				let uri = aURI.spec;

				if (gBrowser.selectedTab.hasAttribute('pending'))
				{
					this.pending = gBrowser.selectedTab.getAttribute('pending');
					this.loadingURI = uri;

					if (uri == 'about:blank')
					{
						launchpadWindow.toggle(true, true);
					}
					else
					{
						launchpadWindow.toggle(false, false);
					}
				}
				else
				{
					if (this.pending)
					{
						if (this.loadingURI == uri)
						{
							this.pending = null;
							this.loadingURI = null;
						}
					}
					else
					{
						if (uri == 'about:blank' && (readyState == 'loading' || readyState == 'complete'))
						{
							launchpadWindow.toggle(true, true);
						}
						else
						{
							launchpadWindow.toggle(false, false);
						}
					}
				}
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

				if (DOMWindow.location.href == 'about:blank' && (readyState == 'loading' || readyState == 'complete'))
				{
					launchpadWindow.toggle(true, true);
				}
			}

			return this;
		},
		uninit : function()
		{
			gBrowser.removeProgressListener(this);
		}
	}.init();

	// gBrowser listener
	let gBrowserListener =
	{
		_listener : null,
		init : function()
		{
			this._listener = function(aEvent)
			{
				let window = aEvent.originalTarget.defaultView;

				if (window == gBrowser.selectedTab.linkedBrowser.contentWindow && window.location.href == 'about:blank')
				{
					launchpadWindow.toggle(true, true);
				}
			}.bind(this);

			gBrowser.addEventListener('load', this._listener, true);

			return this;
		},
		uninit : function()
		{
			gBrowser.removeEventListener('load', this._listener, true);
			this._listener = null;
		}
	}.init();

	//create keyset
	let keyset =
	{
		keyset : null,
		key : null,
		_listener : null,
		_reset : function()
		{
			let keyModifiers = [];
			let keyKeycode = '';
			let {modifiers, keycode} = Prefs.openLaunchdShortcut;
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

			try
			{
				this.keyset.parentNode.removeChild(this.keyset);
			} catch (e) {}

			this.keyset = document.createElement('keyset');
			this.key = document.createElement('key');
			this.key.setAttribute('id', 'launchpad-mozest-org-key');
			this.key.setAttribute('oncommand', 'ToggleLaunchpadWindow();');
			this.key.setAttribute('modifiers', keyModifiers.join(','));
			this.key.setAttribute('keycode', keyKeycode);
			this.keyset.appendChild(this.key);
			document.getElementById('main-window').appendChild(this.keyset);
		},
		init : function()
		{
			this._listener = function(aName)
			{
				aName == 'openLaunchdShortcut' && this._reset();
			}.bind(this);

			PrefListener.add(this._listener);
			this._reset();
			return this;
		},
		uninit : function()
		{
			PrefListener.remove(this._listener);
			try
			{
				this.keyset.parentNode.removeChild(this.keyset);
			} catch (e) {}
			this._listener = null;
		}
	}.init();

	function shutdownHandler()
	{
		removeButton(document, button);
		keyset.uninit();
		gBrowserListener.uninit();
		progressListener.uninit();
		launchpadPopupset.uninit();
		launchpadWindow.uninit();
		styleSheet.uninit();
		aWindow.removeEventListener('unload', onUnload);
	}

	function onUnload()
	{
		keyset.uninit();
		gBrowserListener.uninit();
		progressListener.uninit();
		launchpadPopupset.uninit();
		launchpadWindow.uninit();
		onShutdown.remove(shutdownHandler);
	}

	onShutdown.add(shutdownHandler);

	aWindow.addEventListener('unload', onUnload, false);
});
