/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

'use strict';

const SUPPORTED_DATATRANSFER_DATA_TYPES = ['text/x-moz-url', 'text/x-moz-text-internal'];

let getValidDataTransferDataTypes = function(aTypes)
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

let buttonDropdEventHandler = function(aEvent, aCallback)
{
	let dataTransfer = aEvent.dataTransfer;
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

Launchpad.events =
{
	disableEvent : function(e)
	{
		console.log('mousedown on button');

		e.preventDefault();
		e.stopPropagation();
	},

	dialButtonEvents :
	{
		click : function(e)
		{
			e.preventDefault();
		},
		mouseup : function(e)
		{
			e.preventDefault();

			if ([0, 1].indexOf(e.button) >= 0)
			{
				let uri = e.currentTarget.uri;
				mainWindow.openLinkIn(uri, e.button == 1 ? 'tab' : 'current', {relatedToCurrent : false});
				if (e.button == 0)
				{
					mainWindow.ToggleLaunchpadBox(false);
				}
			}
		},

		mousedown : function(e)
		{
			e.stopPropagation();
		},

		contextmenu : function(e)
		{
			let contextMenu = mainWindow.document.getElementById('launchpad-edit-menu');
			contextMenu.oID = e.currentTarget.oID;
			contextMenu.openPopupAtScreen(e.screenX, e.screenY, true);
			e.preventDefault();
		},

		dragdrop :
		{
			dragState   : false,
			dragElement : null,
			dragID      : null,
			dragIndex   : null,
			dragX       : 0,
			dragY       : 0,
			deltaX      : 0,
			deltaY      : 0,

			dragstart : function(e)
			{
				if ( ! this.dragState)
				{
					this.deltaX = e.pageX;
					this.deltaY = e.pageY;

					this.dragElement = e.currentTarget;

					this.dragID     = this.dragElement.oID;
					this.dragIndex  = Launchpad.bookmarks.getIndexByID(this.dragID);

					this.dragX = 0;
					this.dragY = 0;

					this.dragElement.setAttribute('dragged', true);
					this.dragElement.classList.add('dragged');

					this.dragState = true;

					let dataTransfer = e.dataTransfer;
					let url = this.dragElement.querySelector('.' + DIALPAD_BUTTON_LINK_CLASS).href;
					let title = this.dragElement.querySelector('.' + DIALPAD_BUTTON_TITLE_CLASS).textContent;

					dataTransfer.mozCursor = 'default';
					dataTransfer.effectAllowed = 'move';
					dataTransfer.setData('text/plain', url);
					dataTransfer.setData('text/uri-list', url);
					dataTransfer.setData('text/x-moz-url', url + "\n" + title);
					dataTransfer.setData('text/html', '<a href="' + url + '">' + title + "</a>");

					//let dragElement = document.createElementNS(HTML_NAMESPACE, 'div');
					//dataTransfer.setDragImage(this.dragGhost, 0, 0);
				}
			},

			dragover : function(e)
			{
				if (this.dragState)
				{
					this.dragElement.style.opacity = 0;

					let buttonCurrent = Launchpad.button.current;
					let {clientWidth, clientHeight} = document.documentElement;
					this.dragX = this.dragElement.offsetLeft;
					this.dragY = this.dragElement.offsetTop;

					let getTargetIndex = function()
					{
						for (let index in buttonCurrent.positionMap)
						{
							let {x, y} = buttonCurrent.positionMap[index];

							let width = this.dragX > x
								? buttonCurrent.width - (this.dragX - x)
								: buttonCurrent.width - (x - this.dragX);

							let height = this.dragY > y
								? buttonCurrent.height - (this.dragY - y)
								: buttonCurrent.height - (y - this.dragY);

							if (width > 0 && height > 0 && ((width * height) / buttonCurrent.area) > 0.5 && index != buttonCurrent.num - 1)
							{
								return index;
							}
						}

						return -1;
					}.bind(this);

					this.dragElement.style.left = (this.dragX + e.pageX - this.deltaX) + 'px';
					this.dragElement.style.top  = (this.dragY + e.pageY - this.deltaY) + 'px';

					this.deltaX = e.pageX;
					this.deltaY = e.pageY;

					let targetIndex = getTargetIndex();

					if (targetIndex >= 0 && targetIndex != this.dragIndex)
					{
						let startIndex = Math.min(targetIndex, this.dragIndex);
						let endIndex = Math.max(targetIndex, this.dragIndex);
						Launchpad.bookmarks.swap(this.dragIndex, targetIndex, function()
						{
							this.dragIndex = targetIndex;
							Launchpad.button.resetPosition(startIndex, endIndex, this.dragID);
						}.bind(this));
					}
				}
				else
				{
					e.preventDefault();
					if (getValidDataTransferDataTypes(e.dataTransfer.types).length)
					{
						e.dataTransfer.dropEffect = 'copy';
					}
				}
			},

			dragleave : function(e)
			{
				let {clientWidth, clientHeight} = document.documentElement;
				let {clientX, clientY} = e;

				if (this.dragState && (clientX <= 0 || clientY <= 0 || clientX >= clientWidth || clientY >= clientHeight))
				{
					this.dragend(e);
				}
				else
				{
					this.dragover(e);
				}
			},

			dragend : function(e)
			{
				e.preventDefault();
				if (this.dragState)
				{
					this.dragElement.style.opacity = 1;
					let buttonCurrent = Launchpad.button.current;
					let position = buttonCurrent.positionMap[this.dragIndex];

					this.dragElement.setAttribute('dragged', false);
					this.dragElement.classList.remove('dragged');

					this.dragElement.style.left = position.x + 'px';
					this.dragElement.style.top  = position.y + 'px';
					Launchpad.bookmarks.update(Launchpad.bookmarks[this.dragIndex])

					this.dragX        = 0;
					this.dragY        = 0;
					this.deltaX       = 0;
					this.deltaY       = 0;
					this.dragIndex    = null;
					this.dragID    = null;
					this.dragElement  = null;
					this.dragState    = false;
				}
			},

			dragenter : function(e)
			{
				e.preventDefault();
			},

			drop : function(e)
			{
				buttonDropdEventHandler(e, function(aURI, aTitle)
				{
					let bookmarks = Launchpad.bookmarks;
					bookmarks.update(
					{
						id    : e.currentTarget.oID,
						uri   : aURI,
						title : aTitle,
						type  : bookmarks.TYPE_BOOKMARK
					});
				});
			}
		}
	},

	addButtonEvents :
	{
		click : function(e)
		{
			e.stopPropagation();
			e.preventDefault();
			let panel = document.getElementById('add-bookmark-panel');
			let uriControl = panel.querySelector('input[type="url"]');
			uriControl.value = '';
			uriControl.focus();
			uriControl.select();
			Launchpad.popup.show(panel, e.currentTarget);
		},

		mousedown : function(e)
		{
			e.preventDefault();
			e.stopPropagation();
		},

		dragdrop :
		{
			dragenter : function(e)
			{
				e.preventDefault();
			},

			dragover : function(e)
			{
				e.preventDefault();
				if (getValidDataTransferDataTypes(e.dataTransfer.types).length)
				{
					e.dataTransfer.dropEffect = 'copy';
				}
			},

			drop : function(e)
			{
				buttonDropdEventHandler(e, function(aURI, aTitle)
				{
					let bookmarks = Launchpad.bookmarks;
					bookmarks.add(
					{
						uri      : aURI,
						title    : aTitle,
						type     : bookmarks.TYPE_BOOKMARK,
						index    : bookmarks.DEFAULT_INDEX,
						folderID : bookmarks.folderID
					});
				});
			}
		}
	}
};