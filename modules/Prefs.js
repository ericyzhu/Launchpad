/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

'use strict';

let {Services} = Cu.import('resource://gre/modules/Services.jsm');
let {XPCOMUtils} = Cu.import('resource://gre/modules/XPCOMUtils.jsm');

let {ROOT_PATH_URI, version : ADDON_VERSION} = addonData;
let branchName = 'extensions.launchpad-mozest-org.';
let branch = Services.prefs.getBranch(branchName);
let browserBranch = Services.prefs.getBranch('browser.');

/*
 * PREF_INVALID 0   long
 * PREF_STRING  32  long data type
 * PREF_INT     64  long data type
 * PREF_BOOL    128 long data type
 */
let PREF_TYPE =
{
	0   : 'invalid',
	32  : 'string',
	64  : 'number', // INT
	128 : 'boolean'
};

let TYPE_MAP =
{
	boolean : [getBoolPref,   setBoolPref],
	number  : [getObjectPref, setObjectPref],
	string  : [getCharPref,   setCharPref],
	object  : [getObjectPref, setObjectPref]
};

function getBoolPref(aBranch, aName) aBranch.getBoolPref(aName);
function setBoolPref(aBranch, aName, aValue) aBranch.setBoolPref(aName, aValue);
function getCharPref(aBranch, aName) aBranch.getCharPref(aName);
function setCharPref(aBranch, aName, aValue) aBranch.setCharPref(aName, aValue);
function getObjectPref(aBranch, aName) JSON.parse(aBranch.getCharPref(aName));
function setObjectPref(aBranch, aName, aValue) aBranch.setCharPref(aName, JSON.stringify(aValue));

let shutdownHandler = function()
{
	observer.unregister();
};
let uninstallHandler = function()
{
	if (exports.Prefs.setAsHomepage)
	{
		setCharPref(browserBranch, 'startup.homepage', exports.Prefs.originalHomepage);
	}
	if (exports.Prefs.loadInNewtabPage)
	{
		setCharPref(browserBranch, 'newtab.url', exports.Prefs.originalNewTabURL);
	}
	branch.deleteBranch();
};

let disableHandler = function()
{
	if (exports.Prefs.setAsHomepage)
	{
		setCharPref(browserBranch, 'startup.homepage', exports.Prefs.originalHomepage);
		setBoolPref(branch, 'setAsHomepage', false);
	}
	if (exports.Prefs.loadInNewtabPage)
	{
		setCharPref(browserBranch, 'newtab.url', exports.Prefs.originalNewTabURL);
		setBoolPref(branch, 'loadInNewtabPage', false);
	}
};

let updateNewTabURLPref = function()
{
	try
	{
		let currentNewTabURL = getCharPref(browserBranch, 'newtab.url');
		if (currentNewTabURL == 'about:blank')
		{
			exports.Prefs.loadInNewtabPage = true;
		}
		else
		{
			exports.Prefs.loadInNewtabPage = false;
			exports.Prefs.originalNewTabURL = currentNewTabURL;
		}
	}
	catch(e)
	{
		Cu.reportError(e);
	}
}

let updateHomepagePref = function()
{
	try
	{
		let currentHomepage = getCharPref(browserBranch, 'startup.homepage');
		if (currentHomepage == 'about:blank')
		{
			exports.Prefs.setAsHomepage = true;
		}
		else
		{
			exports.Prefs.setAsHomepage = false;
			exports.Prefs.originalHomepage = currentHomepage;
		}
	}
	catch(e)
	{
		Cu.reportError(e);
	}
}

let observer =
{
	observe : function(aSubject, aTopic, aData)
	{
		if (aTopic == 'nsPref:changed')
		{
			switch (aSubject)
			{
				case branch :
				{
					if ('__update__' + aData in exports.Prefs)
					{
						try
						{
							exports.Prefs['__update__' + aData]();
							for (let i = 0; i < listeners.length; i++)
							{
								try
								{
									listeners[i](aData, exports.Prefs[aData]);
								}
								catch(e)
								{
									Cu.reportError(e);
								}
							}
						}
						catch(e)
						{
							Cu.reportError(e);
						}
					}
					break;
				}

				case browserBranch :
				{
					if (aData == 'startup.homepage')
					{
						updateHomepagePref();
					}
					else if (aData == 'newtab.url')
					{
						updateNewTabURLPref();
					}
					break;
				}
			}
		}
	},
	register : function()
	{
		try
		{
			branch.QueryInterface(Ci.nsIPrefBranch2).addObserver('', this, true);
			browserBranch.QueryInterface(Ci.nsIPrefBranch2).addObserver('', this, true);
		}
		catch (e)
		{
			Cu.reportError(e);
		}
	},
	unregister : function()
	{
		try
		{
			branch.QueryInterface(Ci.nsIPrefBranch2).removeObserver('', this);
			browserBranch.QueryInterface(Ci.nsIPrefBranch2).removeObserver('', this);
		}
		catch (e)
		{
			Cu.reportError(e);
		}
	},
	QueryInterface : XPCOMUtils.generateQI([Ci.nsISupportsWeakReference, Ci.nsIObserver])
}

let listeners = [];

function init()
{
	let scope =
	{
		/**
		 *
		 * @param {String} aName
		 * @param {Boolean|Number|Object|String} aDefaultValue
		 */
		pref : function(aName, aDefaultValue)
		{
			aName = aName.substr(branchName.length);

			let branchPrefType  = PREF_TYPE[branch.getPrefType(aName)];
			let defaultPrefType = typeof(aDefaultValue);
			let [getter, setter] = TYPE_MAP[defaultPrefType];

			let value = aDefaultValue;

			if (branchPrefType == 'invalid' || branchPrefType != (defaultPrefType == 'number' || defaultPrefType == 'object' ? 'string' : defaultPrefType))
			{
				try
				{
					setter(branch, aName, aDefaultValue);
				}
				catch(e)
				{
					Cu.reportError(e);
				}
			}
			else
			{
				try
				{
					value = getter(branch, aName);
				}
				catch(e)
				{
					Cu.reportError(e);
				}
			}

			switch (aName)
			{
				case 'setAsHomepage' :
				{
					exports.Prefs['__update__' + aName] = function()
					{
						value = getter(branch, aName);
						setCharPref(browserBranch, 'startup.homepage', value ? 'about:blank' : exports.Prefs.originalHomepage);
					}
					break;
				}

				case 'loadInNewtabPage' :
				{
					exports.Prefs['__update__' + aName] = function()
					{
						value = getter(branch, aName);
						setCharPref(browserBranch, 'newtab.url', value ? 'about:blank' : exports.Prefs.originalNewTabURL);
					}
					break;
				}

				default :
				{
					exports.Prefs['__update__' + aName] = function()
					{
						value = getter(branch, aName);
					}
					break;
				}
			}

			exports.Prefs.__defineGetter__(aName, function()
			{
				return value;
			});

			exports.Prefs.__defineSetter__(aName, function(aNewValue)
			{
				if (aNewValue == value)
				{
					return value;
				}

				try
				{
					setter(branch, aName, aNewValue);
				}
				catch(e)
				{
					Cu.reportError(e);
				}

				return aNewValue;
			});
		}
	};
	Services.scriptloader.loadSubScript(ROOT_PATH_URI + 'defaults/preferences/launchpad.js', scope);
	observer.register();
	onShutdown.add(uninstallHandler, 'uninstall');
	onShutdown.add(disableHandler, 'disable');
	onShutdown.add(shutdownHandler);
	updateNewTabURLPref();
	updateHomepagePref();

	if (exports.Prefs.version != ADDON_VERSION)
	{
		exports.Prefs.version = ADDON_VERSION;
	}
}

exports.PrefListener =
{
	add : function(aListener)
	{
		if (listeners.indexOf(aListener) < 0)
		{
			listeners.push(aListener);
		}
	},
	remove : function(aListener)
	{
		let index = listeners.indexOf(aListener);

		if (index >= 0)
		{
			listeners.splice(index, 1);
		}
	}
};

exports.Prefs = {};

init();
