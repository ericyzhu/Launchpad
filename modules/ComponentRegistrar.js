/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 **/

'use strict';

Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');

let componentRegistrar = Cm.QueryInterface(Ci.nsIComponentRegistrar);
let factories = [];

exports.ComponentRegistrar =
{
	creatFactory : function(aClass)
	({
		__proto__      : aClass.prototype,
		createInstance : function (aOuter, aIID)
		{
			try
			{
				if (aOuter != null)
				{
					throw Cr.NS_ERROR_NO_AGGREGATION;
				}

				if ( ! aClass.instance)
				{
					aClass.instance = new aClass();
				}

				return aClass.instance.QueryInterface(aIID);
			}
			catch (e)
			{
				Cu.reportError(e);
				throw e;
			}
		}
	}),

	registerFactory : function(aFactory)
	{
		if (factories.indexOf(aFactory) < 0)
		{
			factories.push(aFactory);
			componentRegistrar.registerFactory(aFactory.classID, aFactory.classDescription, aFactory.contractID, aFactory);
		}
	},

	unregisterFactory : function(aFactory)
	{
		if (aFactory)
		{
			componentRegistrar.unregisterFactory(aFactory.classID, aFactory);
		}
	}
}

onShutdown.add(function()
{
	for (let i = 0; i < factories.length; i ++)
	{
		componentRegistrar.unregisterFactory(factories[i].classID, factories[i]);
	}
});
