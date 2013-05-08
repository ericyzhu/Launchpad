/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

'use strict';

let {LOCALE_DIR_URI} = addonData;
let {Services} = Cu.import('resource://gre/modules/Services.jsm', null);
let bundles = {};

exports.Localization =
{
	getBundle : function(aBundleName)
	{
		if ( ! (aBundleName in bundles))
		{
			let bundle = Services.strings.createBundle(LOCALE_DIR_URI + aBundleName +  '.properties');

			if ( ! bundle)
			{
				return Cu.reportError('Localization bundle ' + aBundleName + ' does not exsits.');
			}

			bundles[aBundleName] = bundle;
		}

		let bundle = bundles[aBundleName];

		let localizedString =
		{
			__noSuchProperty__ : function(aName)
			{
				try
				{
					return bundle.GetStringFromName(aName);
				} catch (e) {}

				return '';
			}
		};

		return new Proxy(localizedString,
		{
			get : function(aTarget, aName)
			{
				return aName in aTarget
					? aTarget[aName]
					: aTarget.__noSuchProperty__(aName);
			}
		});
	}
}
