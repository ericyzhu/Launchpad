/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

'use strict';

Launchpad.speeddial = (function()
{
	let speeddial, speeddialItem, folderID, bookmarkIndexes, buttonIndexes, listeners, dialpad, button, addbuttonEl, windowResizeEvent,
		bookmarkLength, livemarkLength, folderLength, separatorLength;

	folderID = null;
	listeners =
	{
		added : [],
		removed : [],
		changed : [],
		moved : [],
		batchUpdated : []
	}

	windowResizeEvent = document.createEvent('HTMLEvents');
	windowResizeEvent.initEvent('resize', false, true);

	speeddialItem = function() {};
	speeddialItem.prototype = new Object;

	let iframe = document.createElementNS(HTML_NAMESPACE, 'iframe');
	iframe.style.display = 'none';
	document.getElementById(CONTAINER_ID).appendChild(iframe);
	iframe.contentWindow.document.open();
	iframe.contentWindow.document.write('<script>parent.speeddialArray = Array;<\/script>');
	iframe.contentWindow.document.close();
	iframe.parentNode.removeChild(iframe);
	iframe = undefined;

	speeddial = speeddialArray;
	speeddial.prototype.__defineGetter__('folderID', function() folderID);
	speeddial.prototype.__defineGetter__('BOOKMARK_TYPE_BOOKMARK', function() BookmarkUtils.TYPE_BOOKMARK);
	speeddial.prototype.__defineGetter__('BOOKMARK_TYPE_LIVEMARK', function() BookmarkUtils.TYPE_LIVEMARK);
	speeddial.prototype.__defineGetter__('BOOKMARK_TYPE_FOLDER', function() BookmarkUtils.TYPE_FOLDER);
	speeddial.prototype.__defineGetter__('BOOKMARK_TYPE_SEPARATOR', function() BookmarkUtils.TYPE_SEPARATOR);
	speeddial.prototype.__defineGetter__('BOOKMARK_DEFAULT_INDEX', function() BookmarkUtils.DEFAULT_INDEX);
	speeddial.prototype.__defineGetter__('STATUS_SUCCESS', function() BookmarkUtils.STATUS_SUCCESS);
	speeddial.prototype.__defineGetter__('STATUS_ERROR', function() BookmarkUtils.STATUS_ERROR);

	speeddial.prototype.__defineGetter__('buttonIndexes', function() buttonIndexes);
	speeddial.prototype.__defineGetter__('bookmarkIndexes', function() bookmarkIndexes);

	speeddial.prototype.push = function(aItem, aBookmarkIndex)
	{
		if (aItem instanceof speeddialItem)
		{
			return Array.prototype.push.call(this, aItem);
		}

		return 0;
	};

	speeddial.prototype.__defineItem__ = function(aBookmarkInfo, aUpdateElementDimensions)
	{
		let {id, uri, title, index, type, folderID} = aBookmarkInfo;
		let element, speeddial = this, item = new speeddialItem(), updateElementDimensions = false;;

		item.__defineGetter__('folderID', function() folderID);
		item.__defineGetter__('id', function() id);
		item.__defineGetter__('type', function() type);
		item.__defineGetter__('index', function() bookmarkIndexes.getItem(this.id));

		if (index >= this.length)
		{
			this[index] = item;
			bookmarkIndexes[item.id] = index;
			bookmarkIndexes.setItem(item.id, index);
			if (item.type == speeddial.BOOKMARK_TYPE_BOOKMARK || item.type == speeddial.BOOKMARK_TYPE_LIVEMARK)
			{
				updateElementDimensions = true;
				buttonIndexes.setItem(item.id, buttonIndexes.length);
			}
		}
		else
		{
			if (speeddial.bookmarkIndexes.hasItem(id)) return;

			speeddial.splice(index, 0, item);
			speeddial.bookmarkIndexes.setItem(id, index);
			let previous, changeButtonIndex = false;

			for (let i = index + 1; i < speeddial.length; i++)
			{
				let {id, index, type} = speeddial[i];
				speeddial.bookmarkIndexes.setItem(id, i);
				if (type == speeddial.BOOKMARK_TYPE_BOOKMARK || type == speeddial.BOOKMARK_TYPE_LIVEMARK)
				{
					changeButtonIndex = true;
					let index = speeddial.buttonIndexes.getItem(id);
					if (previous == undefined) previous = index;
					speeddial.buttonIndexes.setItem(id, index + 1);
				}
			}

			if (changeButtonIndex)
			{
				updateElementDimensions = true;
				if (previous != undefined)
				{
					speeddial.buttonIndexes.setItem(id, previous);
				}
				else
				{
					speeddial.buttonIndexes.setItem(id, buttonIndexes.length);
				}
			}
		}

		if (type == speeddial.BOOKMARK_TYPE_FOLDER || type == speeddial.BOOKMARK_TYPE_SEPARATOR) return;

		item.__defineGetter__('buttonIndex', function() buttonIndexes.getItem(this.id));
		item.__defineGetter__('title', function() title);
		item.__defineSetter__('title', function(aValue)
		{
			if (aValue == title) return title;
			title = aValue;
			this.element.updateTitle();
			return title;
		});
		item.__defineGetter__('uri', function() uri);
		item.__defineSetter__('uri', function(aValue)
		{
			if (aValue == uri) return uri;
			uri = aValue;
			this.element.updateThumbnail();
			return uri;
		});
		item.remove = function()
		{
			let {id, index} = this;
			speeddial.splice(index, 1);
			speeddial.bookmarkIndexes.removeItem(id);
			speeddial.buttonIndexes.removeItem(id);
			for (let i = index; i < speeddial.length; i++)
			{
				let {id, type} = speeddial[i];
				speeddial.bookmarkIndexes.setItem(id, i);

				if (type == speeddial.BOOKMARK_TYPE_BOOKMARK || type == speeddial.BOOKMARK_TYPE_LIVEMARK)
				{
					speeddial.buttonIndexes.setItem(id, speeddial.buttonIndexes.getItem(id) - 1);
				}
			}
			this.element.remove();
			item = undefined;
			button.dimensions.update(true);
		};

		element = button.createElement(item);
		item.__defineGetter__('element', function() element);

		(aUpdateElementDimensions && updateElementDimensions) && button.dimensions.update(true);
	};

	speeddial.prototype.load = function(aFolderID)
	{
		button.removeAll();
		addbuttonEl = null;
		this.splice(0, this.length);
		bookmarkIndexes.clear();
		buttonIndexes.clear();
		folderID = aFolderID;
		addbuttonEl = button.createAddbuttonElement();
		let bookmarks = BookmarkUtils.getBookmarks(this.folderID);
		for (let i = 0; i < bookmarks.length; i++)
		{
			this.__defineItem__(bookmarks[i]);
		}
		button.dimensions.update(true);
	};

	speeddial.prototype.reload = function()
	{
		if (folderID)
		{
			this.load(folderID);
		}
	};

	speeddial.prototype.getItem = function(aID)
	{
		let index = this.bookmarkIndexes.getItem(aID);
		if (index < 0)
		{
			return null;

		}
		return this[index];
	};

	speeddial.prototype.remove = function(aID)
	{
		BookmarkUtils.removeBookmark(aID);
	};

	speeddial.prototype.update = function(aBookmarkInfo)
	{
		BookmarkUtils.updateBookmark(aBookmarkInfo);
	};

	speeddial.prototype.add = function(aBookmarkInfo)
	{
		BookmarkUtils.addBookmark(aBookmarkInfo);
	};

	speeddial.prototype.addListener = function(aType, aCallback)
	{
		if (listeners[aType] && listeners[aType].indexOf(aCallback) < 0)
		{
			listeners[aType].push(aCallback);
		}
	};

	speeddial.prototype.removeListener = function(aType, aCallback)
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
	speeddial.prototype.swap = function(aFromIndex, aToIndex, aCallback)
	{
		if ( ! this.length || typeof(aFromIndex) == 'undefined' || typeof(aToIndex) == 'undefined' || aFromIndex == aToIndex) return;

		let idForFromIndex, idForToIndex, maxIndex, minIndex, fromButtonIndex, toButtonIndex, changeButtonIndex;
		idForFromIndex = this[aFromIndex].id;
		idForToIndex = this[aToIndex].id;
		maxIndex = Math.max(aFromIndex, aToIndex);
		minIndex = Math.min(aFromIndex, aToIndex);
		fromButtonIndex = this.buttonIndexes.getItem(idForFromIndex);
		toButtonIndex = this.buttonIndexes.getItem(idForToIndex);
		changeButtonIndex = false;

		this.splice(aToIndex, 0, this.splice(aFromIndex, 1)[0]);

		if (fromButtonIndex != undefined && toButtonIndex != undefined)
		{
			changeButtonIndex = true;
			this.buttonIndexes.setItem(idForFromIndex, toButtonIndex);
		}

		for (let i = maxIndex; i >= minIndex; i--)
		{
			let {id, type, element} = this[i];

			this.bookmarkIndexes.setItem(id, i);

			if (changeButtonIndex && (type == this.BOOKMARK_TYPE_BOOKMARK || type == this.BOOKMARK_TYPE_LIVEMARK) &&
			    this.buttonIndexes.getItem(id) != undefined && id != idForFromIndex)
			{
				if (aFromIndex > aToIndex)
				{
					this.buttonIndexes.setItem(id, this.buttonIndexes.getItem(id) + 1);
				}
				else
				{
					this.buttonIndexes.setItem(id, this.buttonIndexes.getItem(id) - 1);
				}
			}

			element && element.updateDimensions();
		}

		aCallback && aCallback();
	};

	speeddial.prototype.contextmenuCommand = function(aEvent, aMenuID, aIndex)
	{
		let item = speeddial[aIndex];
		if (item)
		{
			switch (aMenuID)
			{
				case 'popup-edit-item-edit':
					let panel = document.getElementById('panel-edit-item');
					let [addressTextbox, titleTextbox] = panel.querySelectorAll('textbox');
					panel.itemID = item.id;
					addressTextbox.value = item.uri;
					titleTextbox.value = item.title;
					Launchpad.popup.show(panel, item.element);
					addressTextbox.focus();
					addressTextbox.select();
					break;

				case 'popup-edit-item-reload':
					item.element.updateThumbnail(true);
					break;

				case 'popup-edit-item-reload-every':
					break;

				case 'popup-edit-item-remove':
					speeddial.remove(item.id);
					break;
			}
		}
	};

	speeddial.prototype.bookmarkAdded = function(aBookmarkInfo)
	{
		if (aBookmarkInfo.folderID == speeddial.folderID)
		{
			speeddial.__defineItem__(aBookmarkInfo, true);

			for (let i = 0; i < listeners.added.length; i++)
			{
				listeners.added[i](speeddial[aBookmarkInfo.index]);
			}
		}
	};

	speeddial.prototype.bookmarkRemoved = function(aID, aFolderID, aIndex)
	{
		if (aFolderID == speeddial.folderID)
		{
			let {type} = speeddial[aIndex];

			if (type == speeddial.BOOKMARK_TYPE_BOOKMARK || type == speeddial.BOOKMARK_TYPE_LIVEMARK)
			{
				speeddial[aIndex].remove();
			}
			else
			{
				speeddial.splice(aIndex, 1);
				speeddial.bookmarkIndexes.removeItem(aID);
				for (let i = aIndex; i < speeddial.length; i++)
				{
					let {id} = speeddial[i];
					speeddial.bookmarkIndexes.setItem(id, speeddial.bookmarkIndexes.getItem(id) - 1);
				}
			}

			for (let i = 0; i < listeners.removed.length; i++)
			{
				listeners.removed[i](aID, aFolderID, aIndex);
			}
		}
	}

	speeddial.prototype.bookmarkChanged = function(aBookmarkInfo)
	{
		if (aBookmarkInfo.folderID == speeddial.folderID)
		{
			let {id, title, uri} = aBookmarkInfo;
			let item = speeddial[speeddial.bookmarkIndexes.getItem(id)];

			if (title != item.title)
			{
				item.title = title;
			}

			if (uri != item.uri)
			{
				item.uri = uri;
			}

			for (let i = 0; i < listeners.changed.length; i++)
			{
				listeners.changed[i](item);
			}
		}
	}

	speeddial.prototype.bookmarkMoved = function(aID, aOldFolderID, aOldIndex, aNewFolderID, aNewIndex, aType)
	{
		if (aOldFolderID == folderID && aNewFolderID == folderID)
		{
			let idForNewIndex = speeddial[aNewIndex].id;

			if (idForNewIndex != aID)
			{
				speeddial.swap(aOldIndex, aNewIndex, function()
				{
					for (let i = 0; i < listeners.moved.length; i++)
					{
						listeners.moved[i](aID, aOldIndex, idForNewIndex, aNewIndex);
					}
				});
			}
		}
		else if (aOldFolderID == folderID && aNewFolderID != folderID)
		{
			speeddial.bookmarkRemoved(aID, aOldFolderID, aOldIndex);
		}
		else if (aOldFolderID != folderID && aNewFolderID == folderID)
		{
			speeddial.bookmarkAdded(BookmarkUtils.getBookmark(aID));
		}

	}

	speeddial.prototype.bookmarkBatchUpdated = function()
	{
		speeddial.reload();

		for (let i = 0; i < listeners.batchUpdated.length; i++)
		{
			listeners.batchUpdated[i]();
		}
	}

	speeddial.prototype.init = function()
	{
		bookmarkIndexes = new indexTable();
		buttonIndexes = new indexTable();

		this.load(Prefs.bookmarksFolderID);

		window.addEventListener('resize', function() button.dimensions.update(true), false);

		PrefListener.add(prefHandler);
		window.addEventListener('beforeunload', function() PrefListener.remove(prefHandler), false);
		function prefHandler(aName, aValue)
		{
			switch (aName)
			{
				case 'dialpadButtonRatio':
				case 'dialpadButtonAutosizeEnabled':
					window.dispatchEvent(windowResizeEvent);
					break;
			}
		}

		// add-item panel
		(function()
		{
			let panel = document.getElementById('panel-add-item');
			let addressTextbox = panel.querySelector('textbox');
			let [buttonCancel, buttonDone] = panel.querySelectorAll('button');

			buttonCancel.addEventListener('click', function(aEvent) Launchpad.popup.hide(), true);
			buttonDone.addEventListener('click', function(aEvent) saveChanges(), true);
			addressTextbox.addEventListener('keypress', function(aEvent) aEvent.keyCode && aEvent.keyCode == 13 && saveChanges(), false);

			function saveChanges()
			{
				let uri = addressTextbox.value.trim();
				if (uri)
				{
					speeddial.add(
					{
						uri      : uri,
						title    : '',
						type     : speeddial.BOOKMARK_TYPE_BOOKMARK,
						index    : speeddial.BOOKMARK_DEFAULT_INDEX,
						folderID : speeddial.folderID
					});
					Launchpad.popup.hide();
				}
			}
		}());

		// edit-item panel
		(function()
		{
			let panel = document.getElementById('panel-edit-item');
			let [addressTextbox, titleTextbox] = panel.querySelectorAll('textbox');
			let [buttonCancel, buttonDone] = panel.querySelectorAll('button');

			buttonCancel.addEventListener('click', function(aEvent) Launchpad.popup.hide(), true);
			buttonDone.addEventListener('click', function(aEvent) saveChanges(), true);
			addressTextbox.addEventListener('keypress', function(aEvent) aEvent.keyCode && aEvent.keyCode == 13 && saveChanges(), false);
			titleTextbox.addEventListener('keypress', function(aEvent) aEvent.keyCode && aEvent.keyCode == 13 && saveChanges(), false);

			function saveChanges()
			{
				let item = speeddial.getItem(panel.itemID);
				if (item)
				{
					let uri = addressTextbox.value.trim();
					let title = titleTextbox.value.trim();
					if (uri)
					{
						speeddial.update(
						{
							id    : item.id,
							uri   : uri,
							title : title,
							type  : speeddial.BOOKMARK_TYPE_BOOKMARK
						});

						Launchpad.popup.hide();
					}
				}
			}
		}());

		// speeddial settings
		(function()
		{
			let button = document.getElementById('button-settings');
			let panel = document.getElementById('panel-settings');
			button.addEventListener('click', function(e)
			{
				e.button == 0 && Launchpad.popup.show(panel, button);
			}, true);
			button.addEventListener('mousedown', function(aEvent)
			{
				aEvent.stopPropagation();
				aEvent.preventDefault();
			}, true);

			let zoomMode = document.getElementById('zoom-mode');
			let zoomAdjuster = document.getElementById('zoom-adjuster');
			let zoomPercentage = document.getElementById('zoom-percentage');
			zoomMode.value = Prefs.dialpadButtonAutosizeEnabled << 0;

			zoomAdjuster.value = Prefs.dialpadButtonRatio * 100;
			zoomAdjuster.readOnly = Prefs.dialpadButtonAutosizeEnabled;
			zoomPercentage.textContent = (Prefs.dialpadButtonRatio * 100) + '%';
			zoomAdjuster.addEventListener('change', function(e)
			{
				let value = Math.round(zoomAdjuster.value);
				Prefs.dialpadButtonRatio = value / 100;
				zoomPercentage.textContent = value + '%';
			}, false);

			zoomMode.addEventListener('command', function(e)
			{
				let value = zoomMode.value == 1;
				Prefs.dialpadButtonAutosizeEnabled = value;
				zoomAdjuster.readOnly = value;
			}, false);

			updateButtonPositon();

			PrefListener.add(listener);
			window.addEventListener('beforeunload', function(e) PrefListener.remove(listener), false);

			function listener(aName, aValue)
			{
				switch (aName)
				{
					case 'dialpadButtonRatio':
						zoomAdjuster.value = aValue * 100;
						break;

					case 'dialpadButtonAutosizeEnabled':
						zoomMode.value = aValue << 0;
						break;
				}
			}

			function updateButtonPositon()
			{
				let {boxObject : {width}, clientWidth} = scrollbox;
				button.style.right = (width - clientWidth + 20) + 'px';
			}

			window.addEventListener('resize', updateButtonPositon, false);


			//
			let TabsBar = mainWindow.document.getElementById('TabsToolbar');
			let ToolbarMenu = mainWindow.document.getElementById('toolbar-menubar');
			function getToolbarHeight()
			{
				return TabsBar.boxObject.height + ToolbarMenu.boxObject.height;
			}
			let buttonTop = getStyle(button, 'top');
			let {gNavToolbox} = mainWindow;
			gNavToolbox.style.zIndex = 1;
			let options =
			{
				attributes: true,
				attributeOldValue: true,
				attributeFilter: ['style']
			};
			let gNavToolboxObserver = new mainWindow.MutationObserver(function(mutations)
			{
				mutations.forEach(function(mutation)
				{
					let {oldValue} = mutation;
					if (oldValue.indexOf('margin') >= 0 || oldValue.indexOf('height') >= 0)
					{
						let {top, bottom} = gNavToolbox.getBoundingClientRect();
						button.style.top = (buttonTop + (bottom - top - getToolbarHeight())) + 'px';
						panel.classList.contains('active') && Launchpad.popup.show(panel, button);
					}
				});
			}).observe(gNavToolbox, options);

			window.addEventListener('beforeunload', function()
			{
				gNavToolboxObserver.disconnect();
				gNavToolboxObserver = null;
			}, false);
		})();
	};

	speeddial = new speeddial();

	BookmarkUtils.observer.add('added', speeddial.bookmarkAdded);
	BookmarkUtils.observer.add('removed', speeddial.bookmarkRemoved);
	BookmarkUtils.observer.add('changed', speeddial.bookmarkChanged);
	BookmarkUtils.observer.add('moved', speeddial.bookmarkMoved);
	BookmarkUtils.observer.add('batchUpdated', speeddial.bookmarkBatchUpdated);

	window.addEventListener('beforeunload', function(e)
	{
		BookmarkUtils.observer.remove('added', speeddial.bookmarkAdded);
		BookmarkUtils.observer.remove('removed', speeddial.bookmarkRemoved);
		BookmarkUtils.observer.remove('changed', speeddial.bookmarkChanged);
		BookmarkUtils.observer.remove('moved', speeddial.bookmarkMoved);
		BookmarkUtils.observer.remove('batchUpdated', speeddial.bookmarkBatchUpdated);
	}, false);

	dialpad = (function()
	{
		let dialpad = {};
		let element = document.getElementById(DIALPAD_ID);
		dialpad.__defineGetter__('element', function() element);
		dialpad.__defineGetter__('dimensions', function()
		{
			let {clientWidth, clientHeight} = document.documentElement;
			let dimensions = getElementDimensions(element);
			dimensions.availableWidth  = clientWidth -
			                             dimensions.borderLeftWidth - dimensions.borderRightWidth -
			                             dimensions.paddingLeft - dimensions.paddingRight -
			                             dimensions.marginLeft - dimensions.marginRight;
			dimensions.availableHeight = clientHeight -
			                             dimensions.borderTopWidth - dimensions.borderBottomWidth -
			                             dimensions.paddingTop - dimensions.paddingBottom -
			                             dimensions.marginTop - dimensions.marginBottom;
			dimensions.availableArea   = dimensions.availableWidth * dimensions.availableHeight;

			return dimensions;
		});

		return dialpad;
	})();

	button = (function()
	{
		let button = {};

		button.fragment = (function()
		{
			let button = document.createElementNS(HTML_NAMESPACE, 'div');
			button.classList.add(DIALPAD_BUTTON_CONTAINER_CLASS);

			let _background = document.createElementNS(HTML_NAMESPACE, 'span');
			_background.classList.add(DIALPAD_BUTTON_BACKGROUND_CLASS);
			button.appendChild(_background);

			let _link = document.createElementNS(HTML_NAMESPACE, 'a');
			_link.classList.add(DIALPAD_BUTTON_LINK_CLASS);
			_link.setAttribute('draggable', false);
			button.appendChild(_link);

			let __thumbnail = document.createElementNS(HTML_NAMESPACE, 'span');
			__thumbnail.classList.add(DIALPAD_BUTTON_THUMBNAIL_CLASS);
			_link.appendChild(__thumbnail);

			let __title = document.createElementNS(HTML_NAMESPACE, 'span');
			__title.classList.add(DIALPAD_BUTTON_TITLE_CLASS);
			_link.appendChild(__title);

			let _remove = document.createElementNS(HTML_NAMESPACE, 'button');
			_remove.classList.add(DIALPAD_BUTTON_REMOVE_BUTTON_CLASS);
			_remove.setAttribute('title', locale.remove);
			button.appendChild(_remove);

			let _loading = document.createElementNS(HTML_NAMESPACE, 'span');
			_loading.classList.add(DIALPAD_BUTTON_LOADING_CLASS);
			button.appendChild(_loading);

			let fragment = document.createDocumentFragment();
			fragment.appendChild(button);

			return fragment;
		})();

		button.dimensions =
		{
			preset : (function()
			{
				let dimensions = getElementDimensions(button.fragment.firstChild);

				delete dimensions.width;
				delete dimensions.height;
				delete dimensions.offsetWidth;
				delete dimensions.offsetHeight;
				delete dimensions.scrollWidth;
				delete dimensions.scrollHeight;

				// button padding size
				dimensions.paddingWidth  = dimensions.paddingLeft + dimensions.paddingRight;
				dimensions.paddingHeight = dimensions.paddingTop + dimensions.paddingBottom;

				// button default size
				dimensions.defaultWidth  = Prefs.dialpadButtonThumbnailWidthDefault + dimensions.paddingWidth;
				dimensions.defaultHeight = Math.round(Prefs.dialpadButtonThumbnailWidthDefault * Prefs.dialpadButtonThumbnailHeightRatio + Prefs.dialpadButtonTitleHeight + dimensions.paddingHeight);

				// button auto resize mode size
				dimensions.autosizeMinWidth  = Prefs.dialpadButtonThumbnailWidthDefault * Prefs.dialpadButtonRatioAutosizeMin;
				dimensions.autosizeMinHeight = Math.round(dimensions.autosizeMinWidth * Prefs.dialpadButtonThumbnailHeightRatio + Prefs.dialpadButtonTitleHeight + dimensions.paddingHeight);
				dimensions.autosizeMinWidth  = Math.round(dimensions.autosizeMinWidth + dimensions.paddingWidth);
				dimensions.autosizeMaxWidth  = Prefs.dialpadButtonThumbnailWidthDefault * Prefs.dialpadButtonRatioAutosizeMax;
				dimensions.autosizeMaxHeight = Math.round(dimensions.autosizeMaxWidth * Prefs.dialpadButtonThumbnailHeightRatio + Prefs.dialpadButtonTitleHeight + dimensions.paddingHeight);
				dimensions.autosizeMaxWidth  = Math.round(dimensions.autosizeMaxWidth + dimensions.paddingWidth);

				// button manual resize mode size
				dimensions.minWidth  = Prefs.dialpadButtonThumbnailWidthDefault * Prefs.dialpadButtonRatioMin;
				dimensions.minHeight = Math.round(dimensions.minWidth * Prefs.dialpadButtonThumbnailHeightRatio + Prefs.dialpadButtonTitleHeight + dimensions.paddingHeight);
				dimensions.minWidth  = Math.round(dimensions.minWidth + dimensions.paddingWidth);
				dimensions.maxWidth  = Prefs.dialpadButtonThumbnailWidthDefault * Prefs.dialpadButtonRatioMax;
				dimensions.maxHeight = Math.round(dimensions.maxWidth * Prefs.dialpadButtonThumbnailHeightRatio + Prefs.dialpadButtonTitleHeight + dimensions.paddingHeight);
				dimensions.maxWidth  = Math.round(dimensions.maxWidth + dimensions.paddingWidth);

				return dimensions;
			})(),

			current : null,

			update : function(aUpdateAll)
			{
				let current = {};

				let {dialpadButtonThumbnailWidthDefault, dialpadButtonThumbnailHeightRatio, dialpadButtonTitleHeight} = Prefs;

				let preset = this.preset;

				function getValidSize(aWidth, aHeight)
				{
					if (Prefs.dialpadButtonAutosizeEnabled)
					{
						if (aWidth > preset.autosizeMaxWidth || aHeight > preset.autosizeMaxHeight)
						{
							aWidth = preset.autosizeMaxWidth;
							aHeight = preset.autosizeMaxHeight;
						}
						else if (aWidth < preset.autosizeMinWidth || aHeight < preset.autosizeMinHeight)
						{
							aWidth = preset.autosizeMinWidth;
							aHeight = preset.autosizeMinHeight;
						}
					}
					else
					{
						if (aWidth > preset.maxWidth || aHeight > preset.maxHeight)
						{
							aWidth = preset.maxWidth;
							aHeight = preset.maxHeight;
						}
						else if (aWidth < preset.minWidth || aHeight < preset.minHeight)
						{
							aWidth = preset.minWidth;
							aHeight = preset.minHeight;
						}
					}

					return {
						width  : aWidth,
						height : aHeight
					};
				}

				function getSizeByArea(aArea)
				{
					let coefficient = ((Prefs.dialpadButtonTitleHeight + preset.paddingHeight - (preset.paddingWidth * dialpadButtonThumbnailHeightRatio)) / dialpadButtonThumbnailHeightRatio) / 2;
					let width = Math.sqrt(aArea / dialpadButtonThumbnailHeightRatio + Math.pow(coefficient, 2)) - coefficient;

					return getValidSize(Math.floor(width), Math.floor((width - preset.paddingWidth) * dialpadButtonThumbnailHeightRatio + dialpadButtonTitleHeight + preset.paddingHeight));
				}

				function getSizeByRatio(aRatio)
				{
					let width = dialpadButtonThumbnailWidthDefault * aRatio;
					let height = width * dialpadButtonThumbnailHeightRatio + dialpadButtonTitleHeight;
					return getValidSize(width + preset.paddingWidth, height + preset.paddingHeight);
				}

				function getSizeByWidth(aWidth)
				{
					return getValidSize(Math.floor(aWidth), Math.floor((aWidth - preset.paddingWidth) * dialpadButtonThumbnailHeightRatio + dialpadButtonTitleHeight + preset.paddingHeight));
				}

				function getSizeByHeight(aHeight)
				{
					return getValidSize(Math.floor((aHeight - preset.paddingHeight - dialpadButtonTitleHeight) / dialpadButtonThumbnailHeightRatio + preset.paddingWidth), Math.floor(aHeight));
				}

				function getPositon(aIndex)
				{
					return {
						x : aIndex % current.horizontalNum * current.width + current.leftOffset,
						y : Math.floor(aIndex / current.horizontalNum) * current.height + current.topOffset
					};
				}

				let {element : dialpadElement, dimensions : dialpadDimensions} = dialpad;

				current.num = speeddial.buttonIndexes.length + 1;

				if (Prefs.dialpadButtonAutosizeEnabled)
				{
					if (dialpadDimensions.availableWidth == preset.autosizeMinWidth || dialpadDimensions.availableHeight == preset.autosizeMinHeight)
					{
						//let {width, height} = getSizeByRatio(1);
						current.width  = preset.autosizeMinWidth;
						current.height = preset.autosizeMinHeight;
					}
					else
					{
						current.area = dialpadDimensions.availableArea / current.num;

						let {width, height} = getSizeByArea(current.area);

						current.horizontalNum = Math.floor(dialpadDimensions.availableWidth / width);
						current.verticalNum = Math.ceil(current.num / current.horizontalNum);

						if (current.verticalNum * height > dialpadDimensions.availableHeight)
						{
							let horizontalNum = current.horizontalNum + 1;
							let verticalNum = Math.ceil(current.num / horizontalNum);
							let sizeByWidth  = getSizeByWidth(dialpadDimensions.availableWidth / horizontalNum);
							let sizeByHeight = getSizeByHeight(dialpadDimensions.availableHeight / current.verticalNum);

							if (sizeByHeight.height <= sizeByWidth.height && dialpadDimensions.availableWidth / horizontalNum >= sizeByWidth.width)
							{
								if (current.verticalNum * height > dialpadDimensions.availableHeight)
								{

								}
								else
								{

								}
								current.horizontalNum = horizontalNum;
								current.verticalNum = verticalNum;
								width = sizeByWidth.width;
								height = sizeByWidth.height;
							}
							else
							{
								width = sizeByHeight.width;
								height = sizeByHeight.height;
							}

							current.width = width;
							current.height = height;
						}
						else
						{
							current.width = width;
							current.height = height;
						}
					}
				}
				else
				{
					let {width, height} = getSizeByRatio(Prefs.dialpadButtonRatio);
					current.width = width;
					current.height = height;
					current.horizontalNum = Math.floor(dialpadDimensions.availableWidth / width);
				}

				if (current.horizontalNum >= current.num)
				{
					current.horizontalNum = current.num;
					current.verticalNum = 1;
				}
				else
				{
					current.verticalNum = Math.ceil(current.num / current.horizontalNum);
				}

				current.area = current.width * current.height;

				current.innerWidth = current.width - preset.paddingWidth;
				current.innerHeight = current.height - preset.paddingHeight;

				current.leftOffset  = (dialpadDimensions.availableWidth + dialpadDimensions.paddingLeft + dialpadDimensions.paddingRight - current.width * current.horizontalNum) / 2;

				let buttonDivHeight = current.height * current.verticalNum
				if (buttonDivHeight > dialpadDimensions.availableHeight)
				{
					current.topOffset = dialpadDimensions.paddingTop;
				}
				else
				{
					current.topOffset = (dialpadDimensions.availableHeight + dialpadDimensions.paddingTop + dialpadDimensions.paddingBottom - buttonDivHeight) / 2;
				}

				current.positionMap = [];

				for (let i = 0; i < current.num; i++)
				{
					current.positionMap.push(getPositon(i));

				}

				dialpadElement.style.width  = dialpadDimensions.availableWidth + dialpadDimensions.paddingLeft + dialpadDimensions.paddingRight + 'px';
				let dialpadHeight = current.verticalNum * current.height;
				let dialpadMinHeight = dialpadDimensions.availableHeight;
				dialpadElement.style.height = (dialpadHeight < dialpadMinHeight ? dialpadMinHeight : dialpadHeight) + 'px';

				this.current = current;

				if (Prefs.dialpadButtonAutosizeEnabled)
				{
					let zoomAdjuster = document.getElementById('zoom-adjuster');
					zoomAdjuster.value = Math.round(current.innerWidth / Prefs.dialpadButtonThumbnailWidthDefault * 100);
				}

				if (aUpdateAll)
				{
					let {buttonIndexes} = speeddial;

					speeddial.buttonIndexes.each(function(aKey)
					{
						speeddial[speeddial.bookmarkIndexes.getItem(aKey)].element.updateDimensions();
					});

					addbuttonEl && addbuttonEl.updateDimensions();
				}
			}
		};

		button.removeAll = function()
		{
			addbuttonEl && addbuttonEl.removeImmediate();
			if (speeddial.length)
			{
				for (let i = 0; i < speeddial.length; i++)
				{
					speeddial[i].element.removeImmediate();
				}
			}
		};

		button.createElement = function(aBookmark)
		{
			let node, buttonEl, thumbnailEl, removeButtonEl, resizeStopListener, events;
			node           = this.fragment.cloneNode(true);
			buttonEl       = node.firstChild;
			thumbnailEl    = buttonEl.querySelector('.' + DIALPAD_BUTTON_THUMBNAIL_CLASS);
			removeButtonEl = buttonEl.querySelector('.' + DIALPAD_BUTTON_REMOVE_BUTTON_CLASS);

			buttonEl.setAttribute('draggable', true);
			buttonEl.setAttribute('dragged',   false);
			buttonEl.__defineGetter__('bookmark', function() aBookmark);
			buttonEl.__defineGetter__('index', function() this.bookmark.buttonIndex);
			buttonEl.__defineGetter__('thumbnailElement', function() thumbnailEl);
			buttonEl.updateDimensions = function()
			{
				if (this.getAttribute('dragged') == 'true' || this.index < 0) return;

				let {innerWidth, innerHeight, positionMap} = button.dimensions.current;
				let {x, y} = positionMap[this.index];
				this.style.left   = x + 'px';
				this.style.top    = y + 'px';
				this.style.width  = innerWidth  + 'px';
				this.style.height = innerHeight + 'px';
			};
			buttonEl.updateTitle = function()
			{
				let {title} = this.bookmark;
				this.querySelector('.' + DIALPAD_BUTTON_TITLE_CLASS).textContent = title != '' ? title : locale.untitled;
			};
			buttonEl.updateThumbnail = function(aForce)
			{
				let {id, title, uri} = this.bookmark;
				let loaderEl = this.querySelector('.' + DIALPAD_BUTTON_LOADING_CLASS);
				loaderEl.style.display = 'block';
				Thumbnail.getFileURIForBookmark(uri, aForce, function(aStatus, aURI, aMetadata, aFile)
				{
					loaderEl.style.display = 'none';
					if (aStatus == Thumbnail.STATUS_SUCCESS)
					{
						thumbnailEl.style.backgroundImage = 'url("' + aURI + '")';
						if (title == '' && aMetadata.title != '')
						{
							speeddial.update(
							{
								id    : id,
								title : aMetadata.title,
								type  : speeddial.BOOKMARK_TYPE_BOOKMARK
							});
						}
					}
				});
			};
			buttonEl.remove = function()
			{
				window.resizeStopListener.remove(resizeStopListener);

				let removeButton, timer;
				let {innerWidth, innerHeight} = button.dimensions.current;
				this.style.left    = (getStyle(this, 'left') + innerWidth / 2) + 'px';
				this.style.top     = (getStyle(this, 'top') + innerHeight / 2) + 'px';
				this.style.width   = 0;
				this.style.height  = 0;
				this.style.opacity = 0;
				this.style.zIndex  = 5;

				removeButton = function()
				{
					this.parentNode && this.parentNode.removeChild(this);
					buttonEl = undefined;
					window.clearTimeout(timer);
				}.bind(this);

				timer = window.setTimeout(function() removeButton(), 100);
			};

			buttonEl.removeImmediate = function()
			{
				window.resizeStopListener.remove(resizeStopListener);
				this.parentNode && this.parentNode.removeChild(this);
			};

			events = this.dialbuttonEvents;
			buttonEl.addEventListener('click', events.click, false);
			buttonEl.addEventListener('mouseup', events.mouseup, false);
			buttonEl.addEventListener('mousedown', events.mousedown, false);
			buttonEl.addEventListener('contextmenu', events.contextmenu, false);
			buttonEl.addEventListener('dragstart', events.dragdrop.dragstart, true);
			buttonEl.addEventListener('dragover', events.dragdrop.dragover, false);
			buttonEl.addEventListener('dragleave', events.dragdrop.dragleave, false);
			buttonEl.addEventListener('dragend', events.dragdrop.dragend, false);
			buttonEl.addEventListener('dragenter', events.dragdrop.dragenter, false);
			buttonEl.addEventListener('drop', events.dragdrop.drop, false);

			resizeStopListener = function() thumbnailEl.style.imageRendering = 'auto';
			window.addEventListener('resize', function()
			{
				thumbnailEl.style.imageRendering = '-moz-crisp-edges';
			}, true);
			window.resizeStopListener.add(resizeStopListener);

			removeButtonEl.addEventListener('mousedown', function(aEvent)
			{
				aEvent.preventDefault();
				aEvent.stopPropagation();
			}, true);

			removeButtonEl.addEventListener('click', function(aEvent)
			{
				aEvent.preventDefault();
				aEvent.stopPropagation();
				speeddial.remove(buttonEl.bookmark.id);
			}, true);

			buttonEl.updateTitle();
			buttonEl.updateThumbnail();

			dialpad.element.appendChild(node);

			return buttonEl;
		};

		button.createAddbuttonElement = function()
		{
			let buttonEl = document.createElementNS(HTML_NAMESPACE, 'div');
			let events = this.addbuttonEvents;
			buttonEl.innerHTML = '<span/>';
			buttonEl.setAttribute('draggable', false);
			buttonEl.setAttribute('id', DIALPAD_ADD_BUTTON_ID);
			buttonEl.updateDimensions = function()
			{
				if (this.getAttribute('dragged') == 'true') return;

				let {innerWidth, innerHeight, positionMap} = button.dimensions.current;
				let {x, y} = positionMap[speeddial.buttonIndexes.length];
				this.style.left   = x + 'px';
				this.style.top    = y + 'px';
				this.style.width  = innerWidth  + 'px';
				this.style.height = innerHeight + 'px';
			};
			buttonEl.addEventListener('mousedown', events.mousedown, true);
			buttonEl.addEventListener('dragenter', events.dragdrop.dragenter, false);
			buttonEl.addEventListener('dragover', events.dragdrop.dragover, false);
			buttonEl.addEventListener('drop', events.dragdrop.drop, false);
			buttonEl.addEventListener('click', events.click, false);
			buttonEl.removeImmediate = function()
			{
				this.parentNode && this.parentNode.removeChild(this);
			};

			dialpad.element.appendChild(buttonEl);

			return buttonEl;
		};

		button.dialbuttonEvents =
		{
			click : function(aEvent)
			{
				if (aEvent.button == 0)
				{
					mainWindow.openLinkIn(aEvent.currentTarget.bookmark.uri, 'current', {relatedToCurrent : false});
					mainWindow.ToggleLaunchpadBox(false);
				}
				aEvent.preventDefault();
			},

			mousedown : function(aEvent)
			{
				aEvent.stopPropagation();
				Launchpad.popup.hide();
			},

			mouseup : function(aEvent)
			{
				aEvent.preventDefault();

				if (aEvent.button == 1)
				{
					mainWindow.openLinkIn(aEvent.currentTarget.bookmark.uri, 'tab', {relatedToCurrent : true});
				}
			},

			contextmenu : function(aEvent)
			{
				let contextMenu = document.getElementById('popup-edit-item');
				let {currentTarget, screenX, screenY} = aEvent;
				contextMenu.index = currentTarget.bookmark.index;
				contextMenu.openPopupAtScreen(screenX, screenY, true);
				aEvent.preventDefault();
			},

			dragdrop : (function()
			{
				let dragdrop = {};
				let dragState, dragElement, dragIndex, dragX, dragY, deltaX, deltaY;

				function mouseoverEventHandler()
				{
					if (dragState)
					{
						dragdrop.dragend();
					}
				}

				dragdrop.__defineGetter__('dragState', function() dragState);
				dragdrop.dragstart = function(aEvent)
				{
					if ( ! dragState)
					{
						aEvent.stopPropagation();

						let {clientX, clientY, currentTarget, dataTransfer} = aEvent;
						let {scrollLeft, scrollTop} = scrollbox;
						deltaX = clientX + scrollLeft;
						deltaY = clientY + scrollTop;

						dragElement = currentTarget;
						dragElement.setAttribute('dragged', true);
						dragElement.classList.add('dragged');

						dragIndex = dragElement.index
						dragX = 0;
						dragY = 0;

						dragState = true;

						let {url, title} = dragElement.bookmark;

						dataTransfer.mozCursor = 'default';
						dataTransfer.effectAllowed = 'move';
						dataTransfer.setData('text/plain', url);
						dataTransfer.setData('text/uri-list', url);
						dataTransfer.setData('text/x-moz-url', url + "\n" + title);
						dataTransfer.setData('text/html', '<a href="' + url + '">' + title + "</a>");

						let dragGhost = document.createElementNS(HTML_NAMESPACE, 'div');
						dataTransfer.setDragImage(dragGhost, 0, 0);

						// ???
						dragElement.addEventListener('mouseover', mouseoverEventHandler, true);
					}
				};

				dragdrop.dragover = function(aEvent)
				{
					if (dragState)
					{
						let buttonDimensions = button.dimensions.current;
						let {clientX : pageX, clientY : pageY} = aEvent;
						let {scrollLeft, scrollTop} = scrollbox;

						pageX = pageX + scrollLeft;
						pageY = pageY + scrollTop;

						dragX = dragElement.offsetLeft;
						dragY = dragElement.offsetTop;

						let getTargetIndex = function()
						{
							for (let index in buttonDimensions.positionMap)
							{
								let {x, y} = buttonDimensions.positionMap[index];

								let width = dragX > x
									? buttonDimensions.width - (dragX - x)
									: buttonDimensions.width - (x - dragX);

								let height = dragY > y
									? buttonDimensions.height - (dragY - y)
									: buttonDimensions.height - (y - dragY);

								if (width > 0 && height > 0 && ((width * height) / buttonDimensions.area) > 0.5 && index != buttonDimensions.num - 1)
								{
									return index;
								}
							}

							return -1;
						};

						dragElement.style.left = (dragX + pageX - deltaX) + 'px';
						dragElement.style.top  = (dragY + pageY - deltaY) + 'px';

						deltaX = pageX;
						deltaY = pageY;

						let targetIndex = getTargetIndex();

						if (targetIndex >= 0 && targetIndex != dragIndex)
						{
							speeddial.swap(
								speeddial.bookmarkIndexes.getItem(speeddial.buttonIndexes.key(dragIndex)),
								speeddial.bookmarkIndexes.getItem(speeddial.buttonIndexes.key(targetIndex))
							);
							dragIndex = targetIndex;
						}
					}
					else
					{
						aEvent.preventDefault();
						aEvent.stopPropagation();

						let {dataTransfer} = aEvent;
						if (getValidDataTransferDataTypes(dataTransfer.types).length)
						{
							dataTransfer.dropEffect = 'copy';
						}
					}
				};

				dragdrop.dragleave = function(aEvent)
				{
					let {clientWidth, clientHeight} = scrollbox;
					let {clientX, clientY} = aEvent;

					if (dragState && (clientX <= 0 || clientY <= 0 || clientX >= clientWidth || clientY >= clientHeight))
					{
						dragdrop.dragend(aEvent);
					}
					else
					{
						dragdrop.dragover(aEvent);
					}
				};

				dragdrop.dragend = function(aEvent)
				{
					if (dragState)
					{
						dragElement.removeEventListener('mouseover', mouseoverEventHandler, true);
						dragElement.setAttribute('dragged', false);
						dragElement.classList.remove('dragged');
						dragElement.updateDimensions();
						speeddial.update(dragElement.bookmark);
						dragElement = null;
						dragState   = false;
					}
				};

				dragdrop.dragenter = function(aEvent)
				{
					aEvent.preventDefault();
				};

				dragdrop.drop = function(aEvent)
				{
					buttonDropdEventHandler(aEvent, function(aURI, aTitle)
					{
						speeddial.update(
						{
							id    : aEvent.currentTarget.bookmark.id,
							uri   : aURI,
							title : aTitle,
							type  : speeddial.BOOKMARK_TYPE_BOOKMARK
						});
					});
				};

				return dragdrop;
			})()
		};

		button.addbuttonEvents =
		{
			click : function(aEvent)
			{
				aEvent.stopPropagation();
				aEvent.preventDefault();
				let panel = document.getElementById('panel-add-item');
				let addressTextbox = panel.querySelector('textbox');
				addressTextbox.value = '';
				Launchpad.popup.show(panel, aEvent.currentTarget);
				addressTextbox.focus();
				addressTextbox.select();
			},

			mousedown : function(aEvent)
			{
				aEvent.preventDefault();
				aEvent.stopPropagation();
			},

			dragdrop :
			{
				dragenter : function(aEvent)
				{
					aEvent.preventDefault();
				},

				dragover : function(aEvent)
				{
					aEvent.preventDefault();
					try
					{
						let {dataTransfer} = aEvent;
						if (getValidDataTransferDataTypes(dataTransfer.types).length)
						{
							dataTransfer.dropEffect = 'copy';
						}
					}
					catch (e) {}
				},

				drop : function(aEvent)
				{
					try
					{
						buttonDropdEventHandler(aEvent, function(aURI, aTitle)
						{
							speeddial.add(
							{
								uri      : aURI,
								title    : aTitle,
								type     : speeddial.BOOKMARK_TYPE_BOOKMARK,
								index    : speeddial.BOOKMARK_DEFAULT_INDEX,
								folderID : speeddial.folderID
							});
						});
					}
					catch (e) {}
				}
			}
		};

		function getValidDataTransferDataTypes(aTypes)
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
		}

		function buttonDropdEventHandler(aEvent, aCallback)
		{
			let {dataTransfer} = aEvent;

			if ( ! dataTransfer)
			{
				return;
			}

			let types = getValidDataTransferDataTypes(dataTransfer.types);
			if ( ! types.length)
			{
				return;
			}

			aEvent.preventDefault();

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

			if (bookmarkURI)
			{
				bookmarkTitle = bookmarkTitle ? bookmarkTitle : '';
				aCallback && aCallback(bookmarkURI, bookmarkTitle);
			}
		}

		return button;
	})();

	function indexTable()
	{
		this.length = 0;
		this.items = {};
		this.itemsMap = {};

		this.setItem = function(aKey, aValue)
		{
			if ( ! isInt(aValue))
			{
				throw new TypeError('Expecting an integer.');
			}

			let previous = undefined;
			if (this.hasItem(aKey))
			{
				previous = this.items[aKey];
			}
			else
			{
				this.length++;
			}
			this.items[aKey] = aValue;
			this.itemsMap[aValue] = aKey;
			return previous;
		}

		this.getItem = function(aKey)
		{
			return this.hasItem(aKey) ? this.items[aKey] : undefined;
		}

		this.hasItem = function(aKey)
		{
			return this.items.hasOwnProperty(aKey);
		}

		this.removeItem = function(aKey)
		{
			if (this.hasItem(aKey))
			{
				let previous = this.items[aKey];
				this.length--;
				delete this.itemsMap[previous];
				delete this.items[aKey];
				return previous;
			}
			return undefined;
		}

		this.key = function(aValue)
		{
			if (this.itemsMap.hasOwnProperty(aValue))
			{
				return this.itemsMap[aValue];
			}
			return undefined;
		}

		this.keys = function()
		{
			let keys = [];
			for (let k in this.items)
			{
				this.hasItem(k) && keys.push(k);
			}
			return keys;
		}

		this.values = function()
		{
			let values = [];
			for (let k in this.items)
			{
				this.hasItem(k) && values.push(this.items[k]);
			}
			return values;
		}

		this.each = function(aCallback)
		{
			for (let k in this.items)
			{
				this.hasItem(k) && aCallback && aCallback(k, this.items[k]);
			}
		}

		this.clear = function()
		{
			this.itemsMap = {}
			this.items = {}
			this.length = 0;
		}
	}

	return speeddial;
})();
