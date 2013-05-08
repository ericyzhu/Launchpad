/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

const
{
	classes     : Cc,
	Constructor : CC,
	interfaces  : Ci,
	utils       : Cu,
	results     : Cr,
	manager     : Cm
} = Components;

const REASON =
[
	'unknown',
	'startup',
	'shutdown',
	'enable',
	'disable',
	'install',
	'uninstall',
	'upgrade',
	'downgrade'
];

let {Services} = Cu.import('resource://gre/modules/Services.jsm', null);
let {XPCOMUtils} = Cu.import('resource://gre/modules/XPCOMUtils.jsm');
let {AddonManager} = Cu.import('resource://gre/modules/AddonManager.jsm');

let addonData, scopes, shutdownHandlers;

let onShutdown =
{
	add : function(aHandler, aReason)
	{
		aReason = ! aReason ? [] : aReason;
		aHandler = [aHandler, aReason];
		if (shutdownHandlers.indexOf(aHandler) < 0)
		{
			shutdownHandlers.push(aHandler);
		}
	},
	remove : function(aHandler, aReason)
	{
		aReason = ! aReason ? [] : aReason;
		aHandler = [aHandler, aReason];
		let index = shutdownHandlers.indexOf(aHandler);
		if (index >= 0)
		{
			shutdownHandlers.splice(index, 1);
		}
	}
}

let observer =
{
	observe : function(aSubject, aTopic, aData)
	{
		switch (aTopic)
		{
			case 'launchpad-mozest-org:require':
				aSubject.wrappedJSObject.exports = require(aData);
				break;

			case 'launchpad-mozest-org:addonData':
				aSubject.wrappedJSObject.exports = addonData;
				break;
		}
	},
	register : function()
	{
		Services.obs.addObserver(this, 'launchpad-mozest-org:require', true);
		Services.obs.addObserver(this, 'launchpad-mozest-org:addonData', true);
	},
	unregister : function()
	{
		Services.obs.removeObserver(this, 'launchpad-mozest-org:require')
		Services.obs.removeObserver(this, 'launchpad-mozest-org:addonData')
	},
	QueryInterface: XPCOMUtils.generateQI([Ci.nsISupportsWeakReference, Ci.nsIObserver]),
}

function require(aModule)
{
	if ( ! (aModule in scopes))
	{
		scopes[aModule] =
		{
			Cc : Cc,
			CC : CC,
			Ci : Ci,
			Cu : Cu,
			Cr : Cr,
			Cm : Cm,
			addonData  : addonData,
			require    : require,
			onShutdown : onShutdown,
			exports    : {}
		};

		Services.scriptloader.loadSubScript(addonData.ROOT_PATH_URI + 'modules/' + aModule + '.js', scopes[aModule]);
	}

	return scopes[aModule].exports;
}

function startup(aData, aReason)
{
	aReason = REASON[aReason];
	scopes = {};
	shutdownHandlers = [];

	addonData = aData;
	AddonManager.getAddonByID(aData.id, function(aAddon)
	{
		addonData.NAME     = aAddon.name;
	});
	addonData.PACKAGE_NAME     = 'launchpad-mozest-org';
	addonData.MAIN_WIN_URI     = 'chrome://launchpad-mozest-org/content/main.xhtml';
	addonData.MAIN_WIN_TYPE    = 'launchpad-mozest-org:main';
	addonData.OPTIONS_WIN_URI  = 'chrome://launchpad-mozest-org/content/options.xul';
	addonData.OPTIONS_WIN_TYPE = 'launchpad-mozest-org:options';
	addonData.ROOT_PATH_URI    = aData.resourceURI.spec;
	addonData.CONTENT_DIR_URI  = 'chrome://launchpad-mozest-org/content/';
	addonData.SKIN_DIR_URI     = 'chrome://launchpad-mozest-org/skin/';
	addonData.LOCALE_DIR_URI   = 'chrome://launchpad-mozest-org/locale/';
	addonData.STARTUP_REASON   = aReason;

	observer.register();
	require('Main');
}

function shutdown(aData, aReason)
{
	aReason = REASON[aReason];

	for (let i = shutdownHandlers.length - 1; i >= 0; -- i)
	{
		try
		{
			let [handler, handlerReason] = shutdownHandlers[i];

			if (handlerReason.length == 0 || handlerReason.indexOf(aReason) >= 0)
			{
				handler();
			}
		}
		catch (e)
		{
			Cu.reportError(e);
		}
	}
	shutdownHandlers = null;

	observer.unregister()

	for (let key in scopes)
	{
		let scope = scopes[key];
		let list = Object.keys(scope);
		for (let i = 0; i < list.length; i++)
		{
			scope[list[i]] = null;
		}
	}
	scopes = null;

	if (aReason != 'shutdown')
	{
		let browserWindowType = 'navigator:browser';
		let windowTypes = [browserWindowType, addonData.MAIN_WIN_TYPE, addonData.OPTIONS_WIN_TYPE];
		for (let i = 0; i < windowTypes.length; i++)
		{
			let enumerator = Services.wm.getEnumerator(windowTypes[i]);
			while (enumerator.hasMoreElements())
			{
				let item = enumerator.getNext();
				if (windowTypes[i] != browserWindowType)
				{
					item.QueryInterface(Ci.nsIDOMWindow).close();
				}
				if (item.gBrowser)
				{
					let gBrowser =item.gBrowser;
					for (let j = 0; j < gBrowser.tabs.length; j++)
					{
						let tab = gBrowser.tabs[j];
						let browser = gBrowser.getBrowserForTab(tab);
						if (browser.currentURI && (browser.currentURI.spec == addonData.MAIN_WIN_URI || browser.currentURI.spec == addonData.OPTIONS_WIN_URI))
						{
							gBrowser.removeTab(tab);
						}
					}
				}
			}
		}
	}
	addonData = null;
}

function install(aData, aReason)
{
}

function uninstall(aData, aReason)
{
}
