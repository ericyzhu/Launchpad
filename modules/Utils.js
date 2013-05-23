/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

'use strict';

let {atob, btoa} = Cu.import('resource://gre/modules/Services.jsm', null);
let SUPPORTED_DATATRANSFER_DATA_TYPES = ['text/x-moz-url', 'text/x-moz-text-internal'];

exports.Utils =
{
	MD5 : function(aString)
	{
		let converter = Cc['@mozilla.org/intl/scriptableunicodeconverter'].createInstance(Ci.nsIScriptableUnicodeConverter);
		converter.charset = 'UTF-8';
		let data = {};
		data = converter.convertToByteArray(aString, data);
		let cryptoHash = Cc['@mozilla.org/security/hash;1'].createInstance(Ci.nsICryptoHash);
		cryptoHash.init(cryptoHash.MD5);
		cryptoHash.update(data, data.length);
		data = cryptoHash.finish(false);

		function toHexString(aCharCode)
		{
			return ('0' + aCharCode.toString(16)).slice(-2);
		}

		let output = '';

		for (let i in data)
		{
			output += toHexString(data.charCodeAt(i));
		}

		return output;
	},

	dataURItoByteArray : function(aDataURI)
	{
		try
		{
			let byteString = atob(aDataURI.split(',')[1]);
			let array = [];
			for(let i = 0; i < byteString.length; i++)
			{
				array.push(byteString.charCodeAt(i));
			}

			return array;
		}
		catch (e)
		{
			return null;
		}
	},

	dataURIfromByteArray : function(aByteArray, aMimeType)
	{
		try
		{
			let byteString = '';

			for (var i = 0; i < aByteArray.length; i++)
			{
				byteString += String.fromCharCode(parseInt(aByteArray[i]));
			}

			return 'data:' + aMimeType + ';base64,' + btoa(byteString);
		}
		catch (e)
		{
			return null;
		}
	},

	arrayFill : function(aNumber, aValue)
	{
		let array = []

		if ( ! isNaN(aNumber))
		{
			for (let i = 0; i < aNumber; i++)
			{
				array.push(aValue);
			}
		}

		return array;
	},

	filterDataTransferDataTypes : function(aTypes)
	{
		aTypes = SUPPORTED_DATATRANSFER_DATA_TYPES.filter(function(aValue)
		{
			return aTypes.contains(aValue);
		});

		if (aTypes.length)
		{
			return aTypes;
		}

		return [];
	},

	dropEventHandler : function(aEvent, aCallback)
	{
		let {dataTransfer} = aEvent;

		if ( ! dataTransfer)
		{
			return;
		}

		let types = this.filterDataTransferDataTypes(dataTransfer.types);
		if ( ! types.length)
		{
			return;
		}

		//aEvent.preventDefault();

		let type = types.shift();
		let bookmarkURI, bookmarkTitle;

		switch (type)
		{
			case 'text/x-moz-url':
				let [uri, title] = dataTransfer.getData('text/x-moz-url').split(/\n/g);
				bookmarkURI = uri;
				bookmarkTitle = title;
				break;

			case 'text/x-moz-text-internal':
				bookmarkURI = dataTransfer.mozGetDataAt('text/x-moz-text-internal', 0);
				break;
		}

		if (bookmarkURI && bookmarkURI != 'about:launchpad' && bookmarkURI != 'about:blank')
		{
			bookmarkTitle = bookmarkTitle ? bookmarkTitle : '';
			aCallback && aCallback(bookmarkURI, bookmarkTitle);
		}
	},

	subString : function(aString, aLength)
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
}




