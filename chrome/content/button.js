/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

'use strict';

Launchpad.button =
{
	fragment : null,
	preset : null,
	current : null,
	elements : [],

	initPreset : function()
	{
		this.preset = getElementDimensions(this.fragment.firstChild);

		delete this.preset.width;
		delete this.preset.height;
		delete this.preset.offsetWidth;
		delete this.preset.offsetHeight;
		delete this.preset.scrollWidth;
		delete this.preset.scrollHeight;

		// button padding size
		this.preset.paddingWidth  = this.preset.paddingLeft + this.preset.paddingRight;
		this.preset.paddingHeight = this.preset.paddingTop + this.preset.paddingBottom;

		// button default size
		this.preset.defaultWidth  = Prefs.dialpadButtonThumbnailWidthDefault + this.preset.paddingWidth;
		this.preset.defaultHeight = Math.round(Prefs.dialpadButtonThumbnailWidthDefault * Prefs.dialpadButtonThumbnailHeightRatio + Prefs.dialpadButtonTitleHeight + this.preset.paddingHeight);

		// button auto resize mode size
		this.preset.autosizeMinWidth  = Prefs.dialpadButtonThumbnailWidthDefault * Prefs.dialpadButtonRatioAutosizeMin;
		this.preset.autosizeMinHeight = Math.round(this.preset.autosizeMinWidth * Prefs.dialpadButtonThumbnailHeightRatio + Prefs.dialpadButtonTitleHeight + this.preset.paddingHeight);
		this.preset.autosizeMinWidth  = Math.round(this.preset.autosizeMinWidth + this.preset.paddingWidth);
		this.preset.autosizeMaxWidth  = Prefs.dialpadButtonThumbnailWidthDefault * Prefs.dialpadButtonRatioAutosizeMax;
		this.preset.autosizeMaxHeight = Math.round(this.preset.autosizeMaxWidth * Prefs.dialpadButtonThumbnailHeightRatio + Prefs.dialpadButtonTitleHeight + this.preset.paddingHeight);
		this.preset.autosizeMaxWidth  = Math.round(this.preset.autosizeMaxWidth + this.preset.paddingWidth);

		// button manual resize mode size
		this.preset.minWidth  = Prefs.dialpadButtonThumbnailWidthDefault * Prefs.dialpadButtonRatioMin;
		this.preset.minHeight = Math.round(this.preset.minWidth * Prefs.dialpadButtonThumbnailHeightRatio + Prefs.dialpadButtonTitleHeight + this.preset.paddingHeight);
		this.preset.minWidth  = Math.round(this.preset.minWidth + this.preset.paddingWidth);
		this.preset.maxWidth  = Prefs.dialpadButtonThumbnailWidthDefault * Prefs.dialpadButtonRatioMax;
		this.preset.maxHeight = Math.round(this.preset.maxWidth * Prefs.dialpadButtonThumbnailHeightRatio + Prefs.dialpadButtonTitleHeight + this.preset.paddingHeight);
		this.preset.maxWidth  = Math.round(this.preset.maxWidth + this.preset.paddingWidth);
	},

	resetCurrent : function()
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

		let dialpadCurrent = Launchpad.dialpad.current;

		current.num = Launchpad.bookmarks.length + 1;

		if (Prefs.dialpadButtonAutosizeEnabled)
		{
			if (dialpadCurrent.availableWidth == preset.autosizeMinWidth || dialpadCurrent.availableHeight == preset.autosizeMinHeight)
			{
				//let {width, height} = getSizeByRatio(1);
				current.width  = preset.autosizeMinWidth;
				current.height = preset.autosizeMinHeight;
			}
			else
			{
				current.area = dialpadCurrent.availableArea / current.num;

				let {width, height} = getSizeByArea(current.area);

				current.horizontalNum = Math.floor(dialpadCurrent.availableWidth / width);
				current.verticalNum = Math.ceil(current.num / current.horizontalNum);

				if (current.verticalNum * height > dialpadCurrent.availableHeight)
				{
					let horizontalNum = current.horizontalNum + 1;
					let verticalNum = Math.ceil(current.num / horizontalNum);
					let sizeByWidth  = getSizeByWidth(dialpadCurrent.availableWidth / horizontalNum);
					let sizeByHeight = getSizeByHeight(dialpadCurrent.availableHeight / current.verticalNum);

					if (sizeByHeight.height <= sizeByWidth.height && dialpadCurrent.availableWidth / horizontalNum >= sizeByWidth.width)
					{
						if (current.verticalNum * height > dialpadCurrent.availableHeight)
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
			current.horizontalNum = Math.floor(dialpadCurrent.availableWidth / width);
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

		current.leftOffset  = (dialpadCurrent.availableWidth + dialpadCurrent.paddingLeft + dialpadCurrent.paddingRight - current.width * current.horizontalNum) / 2;

		let buttonDivHeight = current.height * current.verticalNum
		if (buttonDivHeight > dialpadCurrent.availableHeight)
		{
			current.topOffset = dialpadCurrent.paddingTop;
		}
		else
		{
			current.topOffset = (dialpadCurrent.availableHeight + dialpadCurrent.paddingTop + dialpadCurrent.paddingBottom - buttonDivHeight) / 2;
		}

		current.positionMap = [];

		for (let i = 0; i < current.num; i++)
		{
			current.positionMap.push(getPositon(i));

		}

		Launchpad.dialpad.element.style.width  = dialpadCurrent.availableWidth + dialpadCurrent.paddingLeft + dialpadCurrent.paddingRight + 'px';
		let dialpadHeight = current.verticalNum * current.height;
		let dialpadMinHeight = dialpadCurrent.availableHeight;
		Launchpad.dialpad.element.style.height = (dialpadHeight < dialpadMinHeight ? dialpadMinHeight : dialpadHeight) + 'px';

		this.current = current;

		if (Prefs.dialpadButtonAutosizeEnabled)
		{
			let zoomAdjuster = document.getElementById('zoom-adjuster');
			zoomAdjuster.value = Math.round(current.innerWidth / Prefs.dialpadButtonThumbnailWidthDefault * 100);
		}
	},

	createFragment : function()
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

		this.fragment = document.createDocumentFragment();
		this.fragment.appendChild(button);
	},

	render : function(aID, aURI, aTitle, aOrderIndex, aCanDrag)
	{
		let node = this.fragment.cloneNode(true);
		let button = node.firstChild;
		let {innerWidth, innerHeight, positionMap} = this.current;
		let position = positionMap[aOrderIndex];

		button.setAttribute('draggable', false);
		button.setAttribute('dragged',   false);
		button.setAttribute('id', DIALPAD_BUTTON_ID_PREFIX + aID);

		button.querySelector('.' + DIALPAD_BUTTON_TITLE_CLASS).textContent = aTitle != '' ? aTitle : locale.untitled;
		button.querySelector('.' + DIALPAD_BUTTON_LINK_CLASS).uri = aURI;

		button.style.left   = position.x + 'px';
		button.style.top    = position.y + 'px';
		button.style.width  = innerWidth  + 'px';
		button.style.height = innerHeight + 'px';
		button.oID          = aID;

		aCanDrag && this.bindEvent(button);

		Launchpad.dialpad.element.appendChild(node);

		this.elements[aID] = button;
	},

	bindEvent : function(aElement)
	{
		let events = Launchpad.events.dialButtonEvents;
		let link = aElement.querySelector('a');

		link.addEventListener('click', events.click, true);
		link.addEventListener('mouseup', events.mouseup, true);

		aElement.addEventListener('mousedown', events.mousedown, false);
		aElement.setAttribute('draggable', true);
		aElement.addEventListener('contextmenu', events.contextmenu, false);
		aElement.addEventListener('dragstart', events.dragdrop.dragstart.bind(events.dragdrop), true);
		aElement.addEventListener('dragover', events.dragdrop.dragover.bind(events.dragdrop), false);
		aElement.addEventListener('dragleave', events.dragdrop.dragleave.bind(events.dragdrop), false);
		aElement.addEventListener('dragend', events.dragdrop.dragend.bind(events.dragdrop), false);
		aElement.addEventListener('dragenter', events.dragdrop.dragenter.bind(events.dragdrop), false);
		aElement.addEventListener('drop', events.dragdrop.drop.bind(events.dragdrop), false);

		aElement.querySelector('.' + DIALPAD_BUTTON_REMOVE_BUTTON_CLASS).addEventListener('click', function(e)
		{
			e.preventDefault();
			e.stopPropagation();
			Launchpad.bookmarks.removeByID(aElement.oID);
		}.bind(this), false);
	},

	renderAll : function()
	{
		this.removeAll();
		for (let i = 0; i < Launchpad.bookmarks.length; i++)
		{
			let {id, title, uri} = Launchpad.bookmarks[i];
			this.render(id, uri, title, i, true);
		}

		let button = document.createElementNS(HTML_NAMESPACE, 'div');
		let {innerWidth, innerHeight, positionMap} = this.current;
		let position = positionMap[Launchpad.bookmarks.length];
		let events = Launchpad.events.addButtonEvents;
		button.innerHTML = '<span/>';
		button.setAttribute('draggable', false);
		button.setAttribute('id', DIALPAD_ADD_BUTTON_ID);
		button.style.left   = position.x + 'px';
		button.style.top    = position.y + 'px';
		button.style.width  = innerWidth  + 'px';
		button.style.height = innerHeight + 'px';
		button.addEventListener('mousedown', events.mousedown, true);
		button.addEventListener('dragenter', events.dragdrop.dragenter, false);
		button.addEventListener('dragover', events.dragdrop.dragover, false);
		button.addEventListener('drop', events.dragdrop.drop, false);
		button.addEventListener('click', events.click, false);

		Launchpad.dialpad.element.appendChild(button);

		this.reloadThumbnail();
	},

	resetPosition : function(aStartIndex, aEndIndex, aSkipID)
	{
		let {innerWidth, innerHeight, positionMap} = this.current;

		aStartIndex = typeof(aStartIndex) !== 'undefined' && ! isNaN(aStartIndex)
			? aStartIndex
			: 0;

		aEndIndex = typeof(aEndIndex) !== 'undefined' && ! isNaN(aEndIndex)
			? aEndIndex + 1
			: Launchpad.bookmarks.length;

		aSkipID = typeof(aSkipID) !== 'undefined' && ! isNaN(aSkipID)
			? aSkipID
			: -1;

		for (let i = aStartIndex; i < aEndIndex; i++)
		{
			let ID =  Launchpad.bookmarks[i].id;
			if (ID != aSkipID)
			{
				let position = positionMap[i];
				let button = document.querySelector('#' + DIALPAD_BUTTON_ID_PREFIX + ID);
				button.style.left    = position.x + 'px';
				button.style.top     = position.y + 'px';
				button.style.width   = innerWidth  + 'px';
				button.style.height  = innerHeight + 'px';
			}
		}

		if (aEndIndex == Launchpad.bookmarks.length)
		{
			let position = positionMap[Launchpad.bookmarks.length];
			let button = document.querySelector('#' + DIALPAD_ADD_BUTTON_ID);
			button.style.left    = position.x + 'px';
			button.style.top     = position.y + 'px';
			button.style.width   = innerWidth  + 'px';
			button.style.height  = innerHeight + 'px';
		}
	},

	reloadThumbnail : function(aID, aForce)
	{
		function loadToElement(aBookmark)
		{
			let {id, title, uri} = aBookmark;
			let bookmarks = Launchpad.bookmarks;
			let selectors = '#' + DIALPAD_BUTTON_ID_PREFIX + id + ' .';
			let loader = document.querySelector(selectors + DIALPAD_BUTTON_LOADING_CLASS);
			let thumbnailElement = document.querySelector(selectors + DIALPAD_BUTTON_THUMBNAIL_CLASS);

			loader.style.display = 'block';

			Thumbnail.getFileURIForBookmark(uri, aForce, function(aStatus, aURI, aMetadata, aFile)
			{
				loader.style.display = 'none';
				if (aStatus == Thumbnail.STATUS_SUCCESS)
				{
					thumbnailElement.style.backgroundImage = 'url("' + aURI + '")';
					if (title == '' && aMetadata.title != '')
					{
						bookmarks.update(
						{
							id    : id,
							title : aMetadata.title,
							type  : bookmarks.TYPE_BOOKMARK
						});
					}
				}
			});
		}

		if ( ! aID)
		{
			for (let i = 0; i < Launchpad.bookmarks.length; i++)
			{
				loadToElement(Launchpad.bookmarks[i]);
			}
		}
		else if (Array.isArray(aID))
		{
			for (let i = 0; i < aID.length; i++)
			{
				loadToElement(Launchpad.bookmarks.getByID(aID[i]));
			}
		}
		else
		{
			loadToElement(Launchpad.bookmarks.getByID(aID));
		}
	},

	remove : function(aID)
	{
		if (this.has(aID))
		{
			let button = document.getElementById(DIALPAD_BUTTON_ID_PREFIX + aID);

			let {innerWidth, innerHeight} = this.current;
			button.style.left    = (parseInt(button.style.left) + innerWidth / 2) + 'px';
			button.style.top     = (parseInt(button.style.top) + innerHeight / 2) + 'px';
			button.style.width   = 0;
			button.style.height  = 0;
			button.style.opacity = 0;
			button.style.zIndex  = 5;

			this.resetCurrent();

			let removeButton = function removeButton()
			{
				if (button.parentNode)
				{
					this.resetPosition();
					button.parentNode.removeChild(button);
				}
			}.bind(this);

			window.setTimeout(function() removeButton(), 100);
		}
	},

	removeAll : function()
	{
		while (Launchpad.dialpad.element.firstChild)
		{
			Launchpad.dialpad.element.removeChild(Launchpad.dialpad.element.firstChild);
		}
	},

	add : function(aID, aURI, aTitle, aOrderIndex)
	{
		if ( ! this.has(aID))
		{
			this.resetCurrent();
			this.render(aID, aURI, aTitle, aOrderIndex, true)
			this.resetPosition();
			this.reloadThumbnail(aID);
		}
	},

	update : function(aID, aURI, aTitle, aOrderIndex)
	{
		if (this.has(aID))
		{
			this.reloadThumbnail(aID);
			document.querySelector('#' + DIALPAD_BUTTON_ID_PREFIX + aID + ' .' + DIALPAD_BUTTON_LINK_CLASS)
				.uri = aURI;
			document.querySelector('#' + DIALPAD_BUTTON_ID_PREFIX + aID + ' .' + DIALPAD_BUTTON_TITLE_CLASS)
				.textContent = aTitle != '' ? aTitle : locale.untitled;
		}
	},

	getButton : function(aID)
	{
		if (this.has(aID))
		{
			return document.getElementById(DIALPAD_BUTTON_ID_PREFIX + aID);
		}

		return null;
	},

	has : function(aID)
	{
		return document.getElementById(DIALPAD_BUTTON_ID_PREFIX + aID) ? true : false;
	},

	contextmenuCommand : function(aEvent, aMenuID, aOID)
	{
		aMenuID = aMenuID.substr('launchpad-edit-menu-'.length)

		switch (aMenuID)
		{
			case 'edit':
				let bookmark = Launchpad.bookmarks.getByID(aOID);
				let panel = document.getElementById('edit-bookmark-panel');
				Launchpad.popup.show(panel, this.getButton(aOID));
				panel.oID = aOID;
				let uriControl = panel.querySelector('input[type="url"]');
				let titleControl = panel.querySelector('input[type="text"]');
				uriControl.value = bookmark.uri;
				titleControl.value = bookmark.title;
				uriControl.focus();
				uriControl.select();
				break;

			case 'reload':
				this.reloadThumbnail(aOID, true);
				break;

			case 'reload-every':
				break;

			case 'remove':
				Launchpad.bookmarks.removeByID(aOID);
				break;
		}
	},

	init : function()
	{
		this.createFragment();
		this.initPreset();
		this.resetCurrent();
		this.renderAll();

		let bookmarkAdded = function(aBookmarkInfo, aOrderIndex)
		{
			let {id, uri, title} = aBookmarkInfo;
			this.add(id, uri, title, aOrderIndex);
			Launchpad.popup.hide();
		}.bind(this);

		let bookmarkRemoved = function(aID, aOrderIndex)
		{
			this.remove(aID);
			Launchpad.popup.hide();
		}.bind(this);

		let bookmarkChanged= function(aBookmarkInfo, aOrderIndex)
		{
			let {id, uri, title} = aBookmarkInfo;
			this.update(id, uri, title, aOrderIndex);
			Launchpad.popup.hide();
		}.bind(this);

		let bookmarkMoved = function(aIDForOldOrderIndex, aOldOrderIndex, aIDForNewOrderIndex, aNewOrderIndex)
		{
			Launchpad.button.resetPosition(aOldOrderIndex, aNewOrderIndex);
			Launchpad.popup.hide();
		}.bind(this);

		let bookmarkBatchUpdated = function()
		{
			this.resetCurrent();
			this.renderAll();
			Launchpad.popup.hide();
		}.bind(this);

		let bookmarks = Launchpad.bookmarks;
		bookmarks.addListener('added', bookmarkAdded);
		bookmarks.addListener('removed', bookmarkRemoved);
		bookmarks.addListener('changed', bookmarkChanged);
		bookmarks.addListener('moved', bookmarkMoved);
		bookmarks.addListener('batchUpdated', bookmarkBatchUpdated);
		window.addEventListener('beforeunload', function(e)
		{
			bookmarks.removeListener('added', bookmarkAdded);
			bookmarks.removeListener('removed', bookmarkRemoved);
			bookmarks.removeListener('changed', bookmarkChanged);
			bookmarks.removeListener('moved', bookmarkMoved);
			bookmarks.removeListener('batchUpdated', bookmarkBatchUpdated);
		}, false);
	}
};
