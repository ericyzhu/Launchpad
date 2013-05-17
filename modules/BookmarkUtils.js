/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

'use strict';

Cu.import('resource://gre/modules/NetUtil.jsm');

let bookmarksService = Cc['@mozilla.org/browser/nav-bookmarks-service;1'].getService(Ci.nsINavBookmarksService);
let historyService = Cc['@mozilla.org/browser/nav-history-service;1'].getService(Ci.nsINavHistoryService);
let livemarksService = Cc['@mozilla.org/browser/livemark-service;2'].getService(Ci.mozIAsyncLivemarks);
var annotationService = Cc['@mozilla.org/browser/annotation-service;1'].getService(Ci.nsIAnnotationService);

let {Prefs} = require('Prefs');
let {NAME : ADDON_NAME} = addonData;

let rootFolder;

let observerHandlers =
{
	added   : [],
	removed : [],
	moved   : [],
	changed : [],
	batchUpdated : []
};

/**
 * bookmarkObject =
 * {
 *      title    : String,
 *      uri      : String,
 *      type     : TYPE_BOOKMARK|TYPE_LIVEMARK|TYPE_FOLDER,
 *      index    : Number,
 *      folderID : Number,
 *      livemark : Object
 * }
 */

let BookmarkUtils = exports.BookmarkUtils =
{
	get DEFAULT_INDEX()  bookmarksService.DEFAULT_INDEX,
	get TYPE_BOOKMARK()  bookmarksService.TYPE_BOOKMARK,
	get TYPE_LIVEMARK()  1024,
	get TYPE_FOLDER()    bookmarksService.TYPE_FOLDER,
	get TYPE_SEPARATOR() bookmarksService.TYPE_SEPARATOR,
	get LMANNO_FEEDURI() 'livemark/feedURI',
	get LMANNO_SITEURI() 'livemark/siteURI',
	get STATUS_SUCCESS() 0,
	get STATUS_ERROR()   1,

	addLivemark : function(aLivemarkInfo)
	{
		livemarksService.addLivemark(aLivemarkInfo);
	},

	addBookmark : function(aBookmarkInfo, aCallback)
	{
		try
		{
			switch (aBookmarkInfo.type)
			{
				case this.TYPE_BOOKMARK:
					if (bookmarksService.insertBookmark(aBookmarkInfo.folderID, NetUtil.newURI(autocompleURI(aBookmarkInfo.uri)), aBookmarkInfo.index, aBookmarkInfo.title))
					{
						aCallback && aCallback();
					}
					break;

				case this.TYPE_FOLDER:
					bookmarksService.createFolder(aBookmarkInfo.folderID, aBookmarkInfo.title, aBookmarkInfo.index);
					break;

				case this.TYPE_LIVEMARK:
					this.addLivemark({
						title    : aBookmarkInfo.title,
						parentId : aBookmarkInfo.folderID,
						index    : aBookmarkInfo.index,
						feedURI  : NetUtil.newURI(autocompleURI(aBookmarkInfo.uri))
					});
					break;
			}
		}
		catch (e) {}
	},

	updateBookmark : function(aBookmarkInfo)
	{
		try
		{
			let oldBookmark = this.getBookmark(aBookmarkInfo.id);

			if (aBookmarkInfo.uri && aBookmarkInfo.uri != oldBookmark.uri && typeof(aBookmarkInfo.type) !== 'undefined' && ! isNaN(aBookmarkInfo.type) != this.TYPE_FOLDER)
			{
				bookmarksService.changeBookmarkURI(aBookmarkInfo.id, NetUtil.newURI(autocompleURI(aBookmarkInfo.uri)));
			}

			if ( ! aBookmarkInfo.title || aBookmarkInfo.title != oldBookmark.title)
			{
				bookmarksService.setItemTitle(aBookmarkInfo.id, aBookmarkInfo.title);
			}

			if (typeof(aBookmarkInfo.folderID) !== 'undefined' && ! isNaN(aBookmarkInfo.folderID) &&
			    typeof(aBookmarkInfo.index) !== 'undefined' && ! isNaN(aBookmarkInfo.index) &&
			    (aBookmarkInfo.folderID != oldBookmark.folderID || aBookmarkInfo.index != oldBookmark.index))
			{
				bookmarksService.moveItem(aBookmarkInfo.id, aBookmarkInfo.folderID, aBookmarkInfo.index > oldBookmark.index ? aBookmarkInfo.index + 1 : aBookmarkInfo.index);
			}
		}
		catch (e) {}
	},

	getBookmarkURI : function(aID, aType)
	{
		let uri = null;

		if ( ! aType)
		{
			aType = this.getBookmarkType(aID);
		}

		if (aType == this.TYPE_FOLDER || aType == this.TYPE_LIVEMARK)
		{
			uri = 'place:folder=' + aID;
		}
		else
		{
			try
			{
				uri = bookmarksService.getBookmarkURI(aID).spec;
			}
			catch(e) {}
		}

		return uri;
	},

	getBookmarkType : function(aID)
	{
		let type;

		try
		{
			type = bookmarksService.getItemType(aID);
		}
		catch(e)
		{
			return null;
		}

		if (type == this.TYPE_FOLDER && annotationService.itemHasAnnotation(aID, this.LMANNO_FEEDURI))
		{
			type = this.TYPE_LIVEMARK;
		}

		return type;
	},

	getLivemark : function(aID, aCallback)
	{
		let result = {livemark : null};

		if (typeof aID == 'number')
		{
			livemarksService.getLivemark({id : aID}, function(aStatus, aLivemark)
			{
				if ( ! Components.isSuccessCode(aStatus))
				{
					aCallback(null);
				}
				else
				{
					aCallback(aLivemark);
				}
			});
		}
		else if (Array.isArray(aID))
		{
			let livemarks = [];

			for (let i = 0; i < livemarkIds.length; i++)
			{
				livemarksService.getLivemark( {id : livemarkIds[i]}, function(aStatus, aLivemark)
				{
					if ( ! Components.isSuccessCode(aStatus))
					{
						aCallback(livemarks);
					}
					else
					{
						livemarks.push(aLivemark);

						if (livemarks.length === livemarkIds.length)
						{
							aCallback(livemarks);
						}
					}
				});
			}
		}
	},

	getBookmark : function(aID)
	{
		let type = this.getBookmarkType(aID);

		if ( ! type || type == this.TYPE_SEPARATOR)
		{
			return null;
		}

		return {
			id	 : aID,
			type	 : type,
			uri	 : this.getBookmarkURI(aID, type),
			title    : bookmarksService.getItemTitle(aID),
			index    : bookmarksService.getItemIndex(aID),
			folderID : bookmarksService.getFolderIdForItem(aID)
		};
	},

	getBookmarks : function(aFolderID, aResultType, aSort, aMaxResults)
	{
		let queryString = this.getBookmarkURI(aFolderID, this.TYPE_FOLDER);

		if (aSort)
		{
			queryString += '&sort=' + aSort;
		}

		if (aMaxResults)
		{
			queryString += '&maxResults=' + aMaxResults;
		}

		let queries = {}, queriesCount = {}, options = {};
		historyService.queryStringToQueries(queryString, queries, queriesCount, options);
		let result = historyService.executeQueries(queries.value, queriesCount.value, options.value);

		let container = result.root;
		let bookmarks = [];
		container.containerOpen = true;

		for (let i = 0; i < container.childCount; i++)
		{
			let item = container.getChild(i);
			let type = this.getBookmarkType(item.itemId);

			if ( ! aResultType || (Array.isArray(aResultType) && aResultType.indexOf(type) >= 0))
			{
				bookmarks.push(
				{
					id       : item.itemId,
					type     : type,
					uri      : item.uri,
					title    : item.title,
					index    : item.bookmarkIndex,
					folderID : item.parent.itemId
				});
			}
		}
		container.containerOpen = false;

		return bookmarks;
	},

	removeBookmark : function(aID)
	{
		try
		{
			bookmarksService.removeItem(aID)
			return true;
		}
		catch (e)
		{
			return false;
		}
	},

	getRootFolderBookmarks : function()
	{
		return this.getBookmarks(rootFolder.id);
	},

	observer :
	{
		add : function(aType, aHandler)
		{
			if (observerHandlers[aType] && observerHandlers[aType].indexOf(aHandler) < 0)
			{
				observerHandlers[aType].push(aHandler);
			}
		},

		remove : function(aType, aHandler)
		{
			if ( ! aType && ! aHandler)
			{
				observerHandlers =
				{
					added   : [],
					removed : [],
					moved   : [],
					changed : [],
					batchUpdated : []
				};
				return;
			}

			if (observerHandlers[aType])
			{
				let index = observerHandlers[aType].indexOf(aHandler);
				if (index >= 0)
				{
					observerHandlers[aType].splice(index, 1);
				}
			}
		}
	}
}

function autocompleURI(aURI)
{
	let pattern = /^[a-z][a-z0-9+-\.]*:/i;

	if ( ! pattern.test(aURI))
	{
		aURI = 'http://' + aURI;
	}

	return aURI;
}

let observer =
{
	onBeginUpdateBatch : function()
	{
	},
	onEndUpdateBatch : function()
	{
		for (let i = 0; i < observerHandlers.batchUpdated.length; i++)
		{
			observerHandlers.batchUpdated[i]();
		}
	},
	onItemAdded : function(aID, aFolderID, aIndex, aType, aURI, aTitle)
	{
		let type = BookmarkUtils.getBookmarkType(aID);

		let bookmark =
		{
			id	 : aID,
			type	 : type,
			uri	 : aURI.spec,
			title    : aTitle,
			index    : aIndex,
			folderID : aFolderID
		};

		for (let i = 0; i < observerHandlers.added.length; i++)
		{
			observerHandlers.added[i](bookmark);
		}
	},
	onItemRemoved : function(aID, aFolderID, aIndex)
	{
		for (let i = 0; i < observerHandlers.removed.length; i++)
		{
			observerHandlers.removed[i](aID, aFolderID, aIndex);
		}
	},
	onItemChanged : function(aID, aProperty, aIsAnnotationProperty, aNewValue, aLastModified, aType, aFolderID)
	{
		let bookmark = BookmarkUtils.getBookmark(aID);

		if ( ! bookmark)
		{
			return;
		}

		for (let i = 0; i < observerHandlers.changed.length; i++)
		{
			observerHandlers.changed[i](bookmark);
		}
	},
	onItemMoved : function(aID, aOldFolderID, aOldIndex, aNewFolderID, aNewIndex, aType)
	{
		if (aType == BookmarkUtils.TYPE_FOLDER && annotationService.itemHasAnnotation(aID, BookmarkUtils.LMANNO_FEEDURI))
		{
			aType = BookmarkUtils.TYPE_LIVEMARK;
		}

		for (let i = 0; i < observerHandlers.moved.length; i++)
		{
			observerHandlers.moved[i](aID, aOldFolderID, aOldIndex, aNewFolderID, aNewIndex, aType);
		}
	},
	onItemVisited : function()
	{
	},
	QueryInterface : function(aIID)
	{
		if (aIID.equals(Ci.nsINavBookmarkObserver) || aIID.equals(Ci.nsISupports))
		{
			return this;
		}
		throw Cr.NS_ERROR_NO_INTERFACE;
	}
};

function init()
{
	rootFolder = BookmarkUtils.getBookmark(Prefs.bookmarksFolderID);

	if ( ! rootFolder || rootFolder.type != BookmarkUtils.TYPE_FOLDER)
	{
		let bookmarks = BookmarkUtils.getBookmarks(bookmarksService.bookmarksMenuFolder, [BookmarkUtils.TYPE_FOLDER]);

		for (let i in bookmarks)
		{
			let bookmark = bookmarks[i];
			if (bookmark.title == ADDON_NAME)
			{
				rootFolder = bookmark;
				break;
			}
		}

		if ( ! rootFolder || rootFolder.type != BookmarkUtils.TYPE_FOLDER)
		{
			rootFolder =
			{
				folderID : bookmarksService.bookmarksMenuFolder,
				type     : BookmarkUtils.TYPE_FOLDER,
				title    : ADDON_NAME,
				index    : BookmarkUtils.DEFAULT_INDEX
			};

			rootFolder.id = BookmarkUtils.addBookmark(rootFolder, function(aBookmark)
			{
				Prefs.bookmarksFolderID = aBookmark.id;

			});
		}
		else
		{
			Prefs.bookmarksFolderID = rootFolder.id;
		}

	}

	bookmarksService.addObserver(observer, false);
	onShutdown.add(function()
	{
		bookmarksService.removeObserver(observer);
		observerHandlers =
		{
			added   : [],
			removed : [],
			moved   : [],
			changed : [],
			batchUpdated : []
		};
	});
}

init();
