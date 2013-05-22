/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 **/

'use strict';

let fileProtocolHandler = Cc['@mozilla.org/network/protocol;1?name=file'].getService(Ci.nsIFileProtocolHandler);
let {FileUtils} = require('FileUtils');
let {Storage : {connection : Storage}} = require('Storage');
let {Snapshot} = require('Snapshot');
let {Utils} = require('Utils');
let {ROOT_PATH_URI} = addonData;
let imgCache = Cc['@mozilla.org/image/tools;1'].getService(Ci.imgITools).getImgCacheForDocument(null);
let defaultImage = ROOT_PATH_URI + 'chrome/skin/icons/blank.png';
let defaultImage2x = ROOT_PATH_URI + 'chrome/skin/icons/blank@2x.png';

let expriesUpdateQueue = [];
let listeners = [];
exports.Thumbnail =
{
	get STATUS_SUCCESS()         0,
	get STATUS_IO_ERROR()        1,
	get STATUS_STORAGE_ERROR()   2,
	get STATUS_STATEMENT_ERROR() 3,
	get STATUS_DRAW_ERROR()      4,
	get TYPE_BOOKMARK()        'bookmark',
	get TYPE_HISTORY()         'history',

	_getFileURIForBookmarkQueue : [],

	getFileURIForBookmark : function(aURI, aFarce, aNeedSyncMetadata, aWindow)
	{
		let leafName = this.getLeafNameForURI(aURI);
		let index = this._getFileURIForBookmarkQueue.indexOf(leafName);
		if (index >= 0) return;
		index = this._getFileURIForBookmarkQueue.push(leafName) - 1;

		let file = this.getFile(this.TYPE_BOOKMARK, leafName);
		let lastModifiedTime = file.exists() ? file.lastModifiedTime : 0;
		let listener = listeners[leafName];

		berore(leafName, file);

		let callback = function(aStatus, aFile, aDocumentTitle)
		{
			if (aStatus == this.STATUS_SUCCESS)
			{
				this.getMetadata(this.TYPE_BOOKMARK, leafName, function(aStatus, aMetadata)
				{
					if (aStatus == this.STATUS_SUCCESS)
					{
						if (aMetadata)
						{
							if (aFarce)
							{
								try
								{
									imgCache.removeEntry(FileUtils.getFileURI(file) + '?' + lastModifiedTime);
								}
								catch (e) {}
							}
							complete(aStatus, this.getFileURI(aFile) + '?' + aFile.lastModifiedTime, aMetadata, aFile, aNeedSyncMetadata);
						}
						else
						{
							//this.getFileURIForBookmark(aURI, true, aSyncTitle);
						}
					}
					else
					{
						complete(aStatus, null, null, null);
					}

				}.bind(this));
			}
			else
			{
				complete(aStatus, null, null, null);
			}

			this._getFileURIForBookmarkQueue.splice(index, 1);

		}.bind(this);

		if ( ! file.exists() || aFarce)
		{
			Snapshot.captureForBookmark(aURI, function(aStatus, aData, aDocumentTitle)
			{
				if (aStatus == Snapshot.STATUS_DRAW_ERROR)
				{
					let imageFile = aWindow.devicePixelRatio == 2 ?
					                FileUtils.getFileByPath(fileProtocolHandler.getFileFromURLSpec(defaultImage2x).path) :
					                FileUtils.getFileByPath(fileProtocolHandler.getFileFromURLSpec(defaultImage).path);
					imageFile.copyTo(file.parent, leafName + '.' + Snapshot.CONTENT_TYPE.split('/')[1]);
					aStatus = Snapshot.STATUS_SUCCESS;
				}

				if (aStatus == Snapshot.STATUS_SUCCESS)
				{
					this.save(this.TYPE_BOOKMARK, aURI, aData, aDocumentTitle, function(aStatus, aFile)
					{
						callback(aStatus, aFile);
						this.updatePageExpriesForBookmark(aURI);
					}.bind(this));
				}
				else
				{
					callback(aStatus, null);
				}
			}.bind(this));
		}
		else
		{
			callback(this.STATUS_SUCCESS, file);
		}

		function berore(aLeafName, aFile)
		{
			try
			{
				if (listener)
				{
					for (let i = 0; i < listener.length; i++)
					{
						let callback = listener[i];
						callback && callback.berore && callback.berore(aLeafName, aFile);
					}
				}
			} catch(e) {}
		}

		function complete(aStatus, aFileURI, aMetadata, aFile, aNeedSyncMetadata)
		{
			try
			{
				if (listener)
				{
					for (let i = 0; i < listener.length; i++)
					{
						let callback = listener[i];
						callback && callback.complete && callback.complete(aStatus, aFileURI, aMetadata, aFile, aNeedSyncMetadata);
					}
				}
			} catch(e) {}
		}
	},

	getLeafNameForURI: function(aURI)
	{
		if (typeof aURI != 'string')
		{
			throw new TypeError('Expecting a string.');
		}
		let leafName = Utils.MD5(aURI);
		return leafName;
	},

	getFile : function(aType, aLeafName)
	{
		let pathArray = ['snapshots', aType];
		for (let i = 10; i < 21; i++)
		{
			(i % 2 == 0) && pathArray.push(aLeafName.substr(i, 2));
		}
		pathArray.push(aLeafName + '.' + Snapshot.CONTENT_TYPE.split('/')[1]);

		let file = FileUtils.getDataFile(pathArray, true);
		return file;
	},

	getFileURI : function(aFile)
	{
		let fileURI = FileUtils.getFileURI(aFile);
		return fileURI.spec;
	},

	getMetadata : function(aType, aLeafName, aCallback)
	{
		try
		{
			Storage.execute('SELECT * FROM ' + aType + 'Snapshots WHERE leafName=:leafName', {leafName : aLeafName}, true,
			{
				onResult : function(aResult)
				{
					let result = null;
					if (aResult)
					{
						result = {};
						let names = ['leafName', 'mimeType', 'URI', 'title', 'lastModified', 'expires', 'reload'];
						for (let i = 0; i < names.length; i++)
						{
							let name = names[i];
							result[name] = aResult.getResultByName(name);
						}
					}
					aCallback(this.STATUS_SUCCESS, result);
				}.bind(this),
				onError : function(aError)
				{
					aCallback(this.STATUS_STORAGE_ERROR, aError);
				}.bind(this)
			});
		}
		catch (e)
		{
			aCallback(this.STATUS_STORAGE_ERROR, null);
		}
	},

	updateMetadata : function(aType, aData, aCallback)
	{
		try
		{
			let leafName =  aData.leafName;

			if ( ! leafName)
			{
				aCallback(this.STATUS_STATEMENT_ERROR, null);
				return;
			}

			Storage.execute('SELECT * FROM ' + aType + 'Snapshots WHERE leafName=:leafName', {leafName : leafName}, true,
			{
				onResult : function(aResult)
				{
					if (aResult)
					{
						let params = [];
						for (let i in aData)
						{
							if ( i != 'leafName')
							{
								params.push(i + '=:' + i);
							}
						}

						let statement = 'UPDATE ' + aType + 'Snapshots SET ' + params.join(',') + ' WHERE leafName=:leafName';

						Storage.execute(statement, aData, true,
						{
							onResult : function(aResult)
							{
								aCallback && aCallback(this.STATUS_SUCCESS, aResult);
							}.bind(this),
							onError : function(aError)
							{
								aCallback && aCallback(this.STATUS_STORAGE_ERROR, aError);
							}.bind(this)
						});
					}
					else
					{
						aData.reload = -1;
						aData.lastModified = new Date().getTime();

						let params = Object.keys(aData);
						let statement = 'INSERT INTO ' + aType + 'Snapshots (' + params.join(',') + ') VALUES(:' + params.join(',:') + ')';

						Storage.execute(statement, aData, true,
						{
							onResult : function(aResult)
							{
								aCallback && aCallback(this.STATUS_SUCCESS, aResult);
							}.bind(this),
							onError : function(aError)
							{
								aCallback && aCallback(this.STATUS_STORAGE_ERROR, aError);
							}.bind(this)
						});
					}
				}.bind(this),
				onError : function(aError)
				{
					aCallback(this.STATUS_STORAGE_ERROR, aError);
				}.bind(this)
			});
		}
		catch (e)
		{
			aCallback(this.STATUS_STORAGE_ERROR, null);
		}
	},

	updatePageExpriesForBookmark : function(aURI)
	{
		if (expriesUpdateQueue.indexOf(aURI) >= 0)
		{
			return;
		}

		if (expriesUpdateQueue.length > 0)
		{
			expriesUpdateQueue.push(aURI);
			return;
		}

		let timer = Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer);

		let update = function()
		{
			let uri = expriesUpdateQueue[0];

			let XMLHttpRequest = CC('@mozilla.org/xmlextras/xmlhttprequest;1', 'nsIXMLHttpRequest', 'open');
			let client = XMLHttpRequest('HEAD', uri, true);
			client.send();
			client.onreadystatechange = function()
			{
				if (client.readyState == 2)
				{
					let expires = client.getResponseHeader('Expires');

					if (expires > 0)
					{
						expires = Date.parse(expires);

						isNaN(expires) && (expires = -1);
					}
					else
					{
						expires = -1;
					}

					this.updateMetadata(this.TYPE_BOOKMARK,
					{
						leafName : this.getLeafNameForURI(uri),
						expires  : expires
					});

					cleanAndContinue();
				}
			}.bind(this);

			timer.initWithCallback(cleanAndContinue, 30 * 1000, Ci.nsITimer.TYPE_ONE_SHOT);

			function cleanAndContinue()
			{
				timer.cancel();
				expriesUpdateQueue.splice(0, 1);
				continueQueue();
			}

		}.bind(this);

		function continueQueue()
		{
			expriesUpdateQueue.length > 0 && update();
		}

		expriesUpdateQueue.push(aURI);
		update();
	},

	save : function(aType, aURI, aData, aDocumentTitle, aCallback)
	{
		let leafName = this.getLeafNameForURI(aURI);
		let file = this.getFile(aType, leafName);

		if (FileUtils.writeFile(file, aData))
		{
			this.updateMetadata(aType,
			{
				leafName : leafName,
				mimeType : Snapshot.CONTENT_TYPE,
				URI      : aURI,
				title    : aDocumentTitle
			}, function(aStatus, aResult)
			{
				if (aStatus == this.STATUS_SUCCESS)
				{
					aCallback(this.STATUS_SUCCESS, file);
				}
				else
				{
					aCallback(aStatus, aResult);
				}
			}.bind(this));
		}
		else
		{
			aCallback(this.STATUS_IO_ERROR, null);
		}
	},

	listener :
	{
		add : function(aListener)
		{
			if ( ! aListener || ! aListener.uri || ! aListener.callback) return;

			let leafName = exports.Thumbnail.getLeafNameForURI(aListener.uri);
			if ( ! listeners[leafName] || ! Array.isArray(listeners[leafName])) listeners[leafName] = [];
			listeners[leafName].push(aListener.callback);
		},
		remove : function(aListener)
		{
			if ( ! aListener || ! aListener.uri) return;

			let leafName = exports.Thumbnail.getLeafNameForURI(aListener.uri);
			if ( ! listeners[leafName]) return;

			if (aListener.callback)
			{
				let index = listeners[leafName].indexOf(aListener.callback);
				if (index >= 0)
				{
					listeners[leafName].splice(index, 1);
				}
			}
			else
			{
				delete listeners[leafName];
			}
		}
	}
}

onShutdown.add(function()
{
	listeners = [];
});

onShutdown.add(function()
{
	FileUtils.removeDataDir('snapshots');
}, ['uninstall']);
