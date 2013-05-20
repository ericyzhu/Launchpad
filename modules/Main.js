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
let {Utils} = require('Utils');
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

WindowObserver.addListener('navigator:browser', 'ready', function(aWindow)
{
	let styleSheet, launchpadWindow, contextMenu, keyset;
	let gBrowser = aWindow.getBrowser(), {document} = aWindow, mainWindow = document.getElementById('main-window');

	// register style sheet
	styleSheet =
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

	// create launchpad window
	launchpadWindow =
	{
		window : null,
		browser : null,
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
				    ! selectedTab.hasAttribute('pending'))
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
		addItemToLaunchpad : function(aURL, aTitle)
		{
			let bookmark =
			{
				uri      : aURL,
				title    : aTitle,
				type     : BookmarkUtils.TYPE_BOOKMARK,
				index    : BookmarkUtils.DEFAULT_INDEX,
				folderID : Prefs.bookmarksFolderID
			};
			BookmarkUtils.addBookmark(bookmark, function()
			{
				try
				{
					aWindow.setTimeout(function()
					{
						alertsService.showAlertNotification(alertIcon,
							subString(bookmark.title != '' ? bookmark.title : bookmark.uri, 48),
							locale.pageOrLinkAddedNotification,
							false, '', null, 'Firefox Extenstion Notification: Launchpad'
						);
					}, 10);

				} catch (e) {}
			});
		},
		init : function()
		{
			let mainWindowContent = document.getElementById('content');

			this.window = document.createElement('box');
			this.window.setAttribute('id', PACKAGE_NAME + '-window');

			this.browser = document.createElement('browser');
			this.browser.setAttribute('id', PACKAGE_NAME + '-browser');
			this.browser.setAttribute('type', 'content');
			this.browser.setAttribute('disablehistory', true);
			this.browser.setAttribute('transparent', 'transparent');
			this.browser.setAttribute('src', MAIN_WIN_URI);

			this.window.appendChild(this.browser);
			mainWindow.appendChild(this.window);

			let hiddenWindow = document.createElement('box');
			hiddenWindow.setAttribute('id', PACKAGE_NAME + '-hidden-window');
			mainWindow.appendChild(hiddenWindow);

			this.resize = function()
			{
				let {x, y, width, height} = mainWindowContent.boxObject;

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
					launchpadWindow.addItemToLaunchpad(window.location.href, window.document.title);
				} catch (e) {}
			};

			aWindow.AddLinkToLaunchpad = function()
			{
				let {gContextMenu} = aWindow;
				let linkText;
				if (gContextMenu.onPlainTextLink)
				{
					linkText = document.commandDispatcher.focusedWindow.getSelection().toString().trim();
				}
				else
				{
					linkText = gContextMenu.linkText();
				}
				launchpadWindow.addItemToLaunchpad(gContextMenu.linkURL, linkText);
			};

			aWindow.LaunchpadButtonEvents =
			{
				onDragenter : function(aEvent)
				{
				},
				onDragover : function(aEvent)
				{
					aEvent.preventDefault();
					try
					{
						let {dataTransfer} = aEvent;
						if (Utils.filterDataTransferDataTypes(dataTransfer.types).length) dataTransfer.dropEffect = 'copy';
					}
					catch (e) {}
				},
				onDrop : function(aEvent)
				{
					let dataTransfer = aEvent.dataTransfer;
					aWindow.setTimeout(function()
					{
						try
						{
							Utils.dropEventHandler({dataTransfer : dataTransfer}, function(aURI, aTitle) launchpadWindow.addItemToLaunchpad(aURI, aTitle));
						}
						catch (e) {}
					}, 0);
				}
			};

			return this;
		},
		uninit : function()
		{
			aWindow.removeEventListener('resize', this.resize, false);
			delete aWindow.ToggleLaunchpadWindow;
			delete aWindow.AddPageToLaunchpad;
			delete aWindow.AddLinkToLaunchpad;
			delete aWindow.LaunchpadButtonEvents;
			this.window.parentNode.removeChild(this.window);
			this.resize = null;
		}
	}.init();

	contextMenu =
	{
		listener : null,
		menuitems : null,
		contentAreaContextMenu : null,
		showItem: function(aItem, aShow)
		{
			aItem.hidden = ! aShow;
		},
		init : function()
		{
			let options =
			{
				attributes: true,
				attributeFilter: ['popupState']
			};
			this.menuitems = [];
			this.observers = [];
			this.contentAreaContextMenu = document.getElementById('contentAreaContextMenu');

			let menuitemBookmarkPage, menuitemBookmarkLink, menuitemAddPage, menuitemAddLink, gContextMenu;
			menuitemBookmarkPage = document.getElementById('context-bookmarkpage');
			menuitemBookmarkLink= document.getElementById('context-bookmarklink');

			menuitemAddPage = document.createElement('menuitem');
			menuitemAddPage.setAttribute('id', PACKAGE_NAME + '-context-add-page-to-launchpad');
			menuitemAddPage.setAttribute('oncommand', 'AddPageToLaunchpad();');
			menuitemAddPage.setAttribute('label', locale.addThisPageToLaunchpad);
			menuitemAddPage.setAttribute('hidden', true);

			menuitemAddLink = document.createElement('menuitem');
			menuitemAddLink.setAttribute('id', PACKAGE_NAME + '-context-add-link-to-launchpad');
			menuitemAddLink.setAttribute('oncommand', 'AddLinkToLaunchpad();');
			menuitemAddLink.setAttribute('label', locale.addThisLinkToLaunchpad);
			menuitemAddLink.setAttribute('hidden', true);

			this.menuitems.push(menuitemAddPage, menuitemAddLink);

			this.contentAreaContextMenu.insertBefore(menuitemAddPage, menuitemBookmarkPage);
			this.contentAreaContextMenu.insertBefore(menuitemAddLink, menuitemBookmarkLink);

			this.listener = function()
			{
				let {gContextMenu} = aWindow;
				if (gContextMenu)
				{
					this.showItem(menuitemAddPage, ! (gContextMenu.isContentSelected || gContextMenu.onTextInput || gContextMenu.onLink || gContextMenu.onImage || gContextMenu.onVideo || gContextMenu.onAudio || gContextMenu.onSocial));
					this.showItem(menuitemAddLink, (gContextMenu.onLink && ! gContextMenu.onMailtoLink && ! gContextMenu.onSocial) || gContextMenu.onPlainTextLink);
				}
			}.bind(this);

			this.contentAreaContextMenu.addEventListener('popupshowing', this.listener, false);

			return this;
		},
		uninit : function()
		{
			this.contentAreaContextMenu.removeEventListener('popupshowing', this.listener, false);
			this.listener = null;
			for (let i = 0; i < this.menuitems.length; i++)
			{
				let menuitem = this.menuitems[i];
				menuitem.parentNode.removeChild(menuitem);
			}
			this.menuitems = null;
		}
	}.init();

	// create keyset
	keyset =
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
		keyset.uninit();
		contextMenu.uninit();
		launchpadWindow.uninit();
		styleSheet.uninit();
		aWindow.removeEventListener('unload', onUnload);
	}

	function onUnload()
	{
		keyset.uninit();
		contextMenu.uninit();
		launchpadWindow.uninit();
		onShutdown.remove(shutdownHandler);
	}

	onShutdown.add(shutdownHandler);

	aWindow.addEventListener('unload', onUnload, false);
});

WindowObserver.addListener('navigator:browser', 'load', function(aWindow)
{
	if (Prefs.firstrun == true)
	{
		Prefs.firstrun = false;
		aWindow.openDialog(OPTIONS_WIN_URI, OPTIONS_WIN_TYPE, 'chrome,titlebar,centerscreen,dialog=yes');
	}

	let pageLoadListener, progressListener;
	let gBrowser = aWindow.getBrowser(), {document} = aWindow, mainWindow = document.getElementById('main-window');

	// add button to toolbar
	let button = document.createElement('toolbarbutton');
	button.setAttribute('id', PACKAGE_NAME + '-toolbar-button');
	button.setAttribute('label', locale.toolbarButtonLabel);
	button.setAttribute('tooltiptext', locale.toolbarButtonTooltip);
	button.setAttribute('oncommand', 'ToggleLaunchpadWindow();');
	button.setAttribute('ondragenter', 'LaunchpadButtonEvents.onDragenter(event);');
	button.setAttribute('ondragover', 'LaunchpadButtonEvents.onDragover(event);');
	button.setAttribute('ondrop', 'LaunchpadButtonEvents.onDrop(event);');
	button.classList.add('toolbarbutton-1');
	button.classList.add('chromeclass-toolbar-additional');
	elementSelector(document, 'navigator-toolbox').palette.appendChild(button);
	setButtonPosition(document, button);

	pageLoadListener =
	{
		appcontent : null,
		onPageLoad : function(aEvent)
		{
			let {URL, defaultView} =  aEvent.originalTarget;
			let {selectedTab} = gBrowser;
			let tab = gBrowser.tabContainer.childNodes[gBrowser.getBrowserIndexForDocument(aEvent.originalTarget)];

			if ( ! tab) return;

			if (typeof(tab.__launchpadFlagTabHasPending__) != 'undefined')
			{
				if (tab.__launchpadFlagTabHasPending__)
				{
					if (tab.__launchpadFlagTabPendingURI__ == defaultView.location.href)
					{
						delete tab.__launchpadFlagTabHasPending__;
						delete tab.__launchpadFlagTabPendingURI__;
					}
					else
					{
						return;
					}
				}
				else
				{
					delete tab.__launchpadFlagTabHasPending__;
					delete tab.__launchpadFlagTabPendingURI__;
				}
			}

			if (tab == selectedTab)
			{
				if (URL == 'about:blank')
				{
					aWindow.ToggleLaunchpadWindow(true);
				}
				else
				{
					aWindow.ToggleLaunchpadWindow(false);
				}
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
	progressListener =
	{
		QueryInterface : XPCOMUtils.generateQI(['nsIWebProgressListener', 'nsISupportsWeakReference']),
		loadingURI : null,
		onLocationChange : function(aProgress, aRequest, aURI)
		{
			let DOMWindow = aProgress.DOMWindow;
			let {selectedTab} = gBrowser;
			let {readyState} = DOMWindow.document;
			let uri = aURI.spec;

			if (uri == 'about:blank' && readyState == 'uninitialized' && ( ! selectedTab.hasAttribute('pending') || ! selectedTab.__launchpadFlagTabHasPending__)) return;

			if (selectedTab.hasAttribute('pending'))
			{
				aWindow.ToggleLaunchpadWindow(false);
				selectedTab.__launchpadFlagTabHasPending__ = true;
				selectedTab.__launchpadFlagTabPendingURI__ = uri;
			}
			else
			{
				if ( ! selectedTab.__launchpadFlagTabHasPending__)
				{
					if (uri == 'about:blank' && readyState == 'complete')
					{
						aWindow.ToggleLaunchpadWindow(true);
					}
					else
					{
						aWindow.ToggleLaunchpadWindow(false);
					}
				}
				else
				{
					if ((readyState == 'loading' || readyState == 'complete') && selectedTab.__launchpadFlagTabPendingURI__ != 'about:blank')
					{
						delete selectedTab.__launchpadFlagTabHasPending__;
						delete selectedTab.__launchpadFlagTabPendingURI__;
					}
				}
			}
		},
		init : function()
		{
			gBrowser.addProgressListener(this);

			if (gBrowser.tabs.length < 2)
			{
				let DOMWindow = gBrowser.tabs[0].linkedBrowser.contentWindow;
				let readyState = DOMWindow.document.readyState;

				if (DOMWindow.location.href == 'about:blank' && readyState == 'complete')
				{
					aWindow.ToggleLaunchpadWindow(true);
				}
			}

			return this;
		},
		uninit : function()
		{
			gBrowser.removeProgressListener(this);
		}
	}.init();

	function shutdownHandler()
	{
		pageLoadListener.uninit();
		progressListener.uninit();
		removeButton(document, button);
		aWindow.removeEventListener('unload', onUnload);
	}

	function onUnload()
	{
		pageLoadListener.uninit();
		progressListener.uninit();
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
