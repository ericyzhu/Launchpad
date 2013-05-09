/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

'use strict';

Launchpad.bookmarks = (function()
{
	let func = Array;
	let folderID = null;
	let bookmarksMap = {};
	let listeners =
	{
		added : [],
		removed : [],
		changed : [],
		moved : [],
		batchUpdated : []
	}

	func.prototype.__defineGetter__('folderID', function() folderID);
	func.prototype.__defineGetter__('TYPE_BOOKMARK', function() BookmarkUtils.TYPE_BOOKMARK);
	func.prototype.__defineGetter__('TYPE_LIVEMARK', function() BookmarkUtils.TYPE_LIVEMARK);
	func.prototype.__defineGetter__('TYPE_FOLDER', function() BookmarkUtils.TYPE_FOLDER);
	func.prototype.__defineGetter__('STATUS_SUCCESS', function() BookmarkUtils.STATUS_SUCCESS);
	func.prototype.__defineGetter__('STATUS_ERROR', function() BookmarkUtils.STATUS_ERROR);
	func.prototype.__defineGetter__('DEFAULT_INDEX', function() BookmarkUtils.DEFAULT_INDEX);

	func.prototype.load = function(aFolderID)
	{
		folderID = aFolderID;
		let bookmarks = BookmarkUtils.getBookmarks(this.folderID, [BookmarkUtils.TYPE_BOOKMARK]);
		for (let i = 0; i < bookmarks.length; i++)
		{
			this[i] = bookmarks[i];
		}
	};

	func.prototype.reload = function()
	{
		if (folderID)
		{
			this.load(folderID);
		}
	};

	func.prototype.getByID = function(aID)
	{
		let index = this.getIndexByID(aID);
		if (index < 0)
		{
			return null;

		}
		return this[index];
	};

	func.prototype.getIndexByID = function(aID)
	{
		for (let i = 0; i < this.length; i++)
		{
			if (this[i].id == aID)
			{
				return i;
			}
		}

		return -1;
	};

	func.prototype.getIndexByBookmarkIndex = function(aBookmarkIndex)
	{
		for (let i = 0; i < this.length; i++)
		{
			if (this[i].index == aBookmarkIndex)
			{
				return i;
			}
		}

		return -1;
	};

	func.prototype.removeByID = function(aID)
	{
		BookmarkUtils.removeBookmark(aID);
	};

	func.prototype.removeByIndex = function(aIndex)
	{
		if (BookmarkUtils.removeBookmark(this[aIndex].id))
		{
			this.splice(aIndex, 1);
		}
	};

	func.prototype.update = function(aBookmarkInfo)
	{
		BookmarkUtils.updateBookmark(aBookmarkInfo);
	};

	func.prototype.add = function(aBookmarkInfo, aCallback)
	{
		BookmarkUtils.addBookmark(aBookmarkInfo);
	};

	func.prototype.addListener = function(aType, aCallback)
	{
		if (listeners[aType] && listeners[aType].indexOf(aCallback) < 0)
		{
			listeners[aType].push(aCallback);
		}
	};

	func.prototype.removeListener = function(aType, aCallback)
	{
		if ( ! aType && ! aCallback)
		{
			listeners =
			{
				added   : [],
				removed : [],
				moved   : [],
				changed : [],
				batchUpdated : []
			};
			return;
		}

		if (listeners[aType])
		{
			let index = listeners[aType].indexOf(aCallback);
			if (index >= 0)
			{
				listeners[aType].splice(index, 1);
			}
		}
	};

	// 这里并不真正更新浏览器的书签索引，需要在拖拽完成时调用 update() 方法以避免影响性能。
	func.prototype.swap = function(aFromIndex, aToIndex, aCallback)
	{
		if (typeof(aFromIndex) == 'undefined' || typeof(aToIndex) == 'undefined' || aFromIndex == aToIndex || ! this.length)
		{
			return;
		}

		this[aFromIndex].index = this[aToIndex].index;
		if (aToIndex > aFromIndex)
		{
			for (let i = aToIndex; i > aFromIndex; i--)
			{
				this[i].index = this[i].index - 1;
			}
		}
		else
		{
			for (let i = aToIndex; i < aFromIndex; i++)
			{
				this[i].index = this[i].index + 1;
			}
		}
		this.splice(aToIndex, 0, this.splice(aFromIndex, 1)[0]);

		aCallback && aCallback();
	};

	let object = new func();

	function added(aBookmarkInfo)
	{
		let orderIndex = object.getIndexByID(aBookmarkInfo.id);
		if (aBookmarkInfo.folderID == folderID && orderIndex < 0)
		{
			for (let i = 0; i < object.length; i++)
			{
				if (aBookmarkInfo.index == object[i].index)
				{
					orderIndex = i;
					break;
				}
			}

			orderIndex = orderIndex < 0 ? object.length : orderIndex;
			object.splice(orderIndex, 0, aBookmarkInfo);
			for (let i = 0; i < listeners.added.length; i++)
			{
				listeners.added[i](aBookmarkInfo, orderIndex);
			}
		}
	}

	function removed(aID, aFolderID, aIndex)
	{
		let orderIndex = object.getIndexByID(aID);
		if (aFolderID == folderID && orderIndex >= 0)
		{
			object.splice(orderIndex, 1);

			for (let i = 0; i < listeners.removed.length; i++)
			{
				listeners.removed[i](aID, orderIndex);
			}
		}
	}

	function changed(aBookmarkInfo, aIndex)
	{
		let orderIndex = object.getIndexByID(aBookmarkInfo.id);
		if (aBookmarkInfo.folderID == folderID && orderIndex >= 0)
		{
			object[orderIndex] = aBookmarkInfo;

			for (let i = 0; i < listeners.changed.length; i++)
			{
				listeners.changed[i](aBookmarkInfo, orderIndex);
			}
		}
	}

	function moved(aID, aOldFolderID, aOldIndex, aNewFolderID, aNewIndex, aType)
	{
		if (aOldFolderID == folderID && aNewFolderID == folderID)
		{
			let oldOrderIndex = object.getIndexByBookmarkIndex(aOldIndex);
			let newOrderIndex = object.getIndexByBookmarkIndex(aNewIndex);
			let IDForNewOrderIndex = object[newOrderIndex].id;

			if (IDForNewOrderIndex != aID)
			{
				object.swap(oldOrderIndex, newOrderIndex, function()
				{
					for (let i = 0; i < listeners.moved.length; i++)
					{
						listeners.moved[i](aID, oldOrderIndex, IDForNewOrderIndex, newOrderIndex);
					}
				});
			}
		}
		else if (aOldFolderID == folderID && aNewFolderID != folderID)
		{
			removed(aID, aOldFolderID, aOldIndex);
		}
		else if (aOldFolderID != folderID && aNewFolderID == folderID)
		{
			added(BookmarkUtils.getBookmark(aID));
		}
	}

	function batchUpdated()
	{
		object.reload();

		for (let i = 0; i < listeners.batchUpdated.length; i++)
		{
			listeners.batchUpdated[i]();
		}
	}

	BookmarkUtils.observer.add('added', added);
	BookmarkUtils.observer.add('removed', removed);
	BookmarkUtils.observer.add('changed', changed);
	BookmarkUtils.observer.add('moved', moved);
	BookmarkUtils.observer.add('batchUpdated', batchUpdated);

	window.addEventListener('beforeunload', function(e)
	{
		BookmarkUtils.observer.remove('added', added);
		BookmarkUtils.observer.remove('removed', removed);
		BookmarkUtils.observer.remove('changed', changed);
		BookmarkUtils.observer.remove('moved', moved);
		BookmarkUtils.observer.remove('batchUpdated', batchUpdated);
	}, false);

	return object;
})();
