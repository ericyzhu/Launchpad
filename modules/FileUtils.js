/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the 'License'). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

'use strict';

Cu.import('resource://gre/modules/Services.jsm');

exports.FileUtils =
{
	get MODE_RDONLY()   0x01,
	get MODE_WRONLY()   0x02,
	get MODE_RDWR()     0x04,
	get MODE_CREATE()   0x08,
	get MODE_APPEND()   0x10,
	get MODE_TRUNCATE() 0x20,

	get PERMS_FILE()      0x1b6,
	get PERMS_DIRECTORY() 0x1ff,

	getDir : function(aKey, aPathArray, aShouldCreate)
	{
		let dir = Services.dirsvc.get(aKey, Ci.nsILocalFile);

		for (var i = 0; i < aPathArray.length; i++)
		{
			dir.append(aPathArray[i]);
			if (aShouldCreate && ! dir.exists())
			{
				dir.create(Ci.nsILocalFile.DIRECTORY_TYPE, this.PERMS_DIRECTORY);
			}
		}

		return dir;
	},

	createDir : function(aDir)
	{
		try
		{
			aDir.create(Ci.nsILocalFile.DIRECTORY_TYPE, this.PERMS_DIRECTORY);
			return true;
		}
		catch (e)
		{
			return false;
		}
	},

	getFile : function(aKey, pathArray, aShouldCreateDir)
	{
		let file = this.getDir(aKey, pathArray.slice(0, -1), aShouldCreateDir);
		file.append(pathArray[pathArray.length - 1]);

		return file;
	},

	getFileByPath : function(aPath)
	{
		let file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
		file.initWithPath(aPath);

		return file;
	},

	getFileURIByPath : function(aPath)
	{
		let file = this.getFileByPath(aPath);
		return this.getFileURI(file);
	},

	getFileURI : function(aFile)
	{
		return Services.io.newFileURI(aFile);
	},

	writeFile : function(aFile, aData)
	{
		try
		{
			let stream = Cc['@mozilla.org/network/safe-file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);
			stream.init(aFile, this.MODE_RDWR | this.MODE_CREATE | this.MODE_TRUNCATE, this.PERMS_FILE, stream.DEFER_OPEN);
			stream.write(aData, aData.length);

			if (stream instanceof Ci.nsISafeOutputStream)
			{
				stream.finish();
			}
			else
			{
				stream.close();
			}

			return true;
		}
		catch (e)
		{
			return false;
		}
	},

	readFile : function(aFile, aCharset)
	{
		let fileStream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
		let converterStream = Cc['@mozilla.org/intl/converter-input-stream;1'].createInstance(Ci.nsIConverterInputStream);
		fileStream.init(aFile, this.MODE_RDONLY, 0, 0);
		converterStream.init(fileStream, aCharset ? aCharset : 'UTF-8', fileStream.available(), converterStream.DEFAULT_REPLACEMENT_CHARACTER);

		let output = {};
		converterStream.readString(fileStream.available(), output);
		converterStream.close();
		fileStream.close();

		return output.value;
	},

	getDataDir : function(aPathArray, aShouldCreate)
	{
		aPathArray.unshift('extensions.' + addonData.id);
		return this.getDir('ProfD', aPathArray, aShouldCreate);
	},

	getDataFile : function(aPathArray, aShouldCreateDir)
	{
		let file = this.getDataDir(aPathArray.slice(0, -1), aShouldCreateDir);
		file.append(aPathArray[aPathArray.length - 1]);

		return file;
	},

	removeDataFile : function(aPathArray)
	{
		try
		{
			this.getDataFile(aPathArray).remove();
			return true;
		}
		catch (e)
		{
			return false;
		}
	},

	removeDataDir : function(aPathArray)
	{
		try
		{
			this.getDataDir(aPathArray).remove(true);
			return true;
		}
		catch (e)
		{
			return false;
		}
	}
}
