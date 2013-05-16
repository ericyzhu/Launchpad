/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

'use strict';

Launchpad.popup =
{
	get boxShadowBlur() 10,
	get borderRadius() 10,
	popupElement : null,
	targetElement : null,
	styleSheet : null,

	_resetArrow : function(aPlace, aPosition)
	{
		let places = ['top', 'bottom', 'left', 'right'];

		this.popupElement.classList.remove('top');
		this.popupElement.classList.remove('bottom');
		this.popupElement.classList.remove('left');
		this.popupElement.classList.remove('right');

		let css = 'div.popup.' + aPlace + ':after' + '{';
		if (aPlace == 'top' || aPlace == 'bottom')
		{
			css += 'left';
		}
		else
		{
			css += 'top';
		}
		css += ':' + Math.round(aPosition) + 'px}';

		this.styleSheet.innerHTML = css;
		this.popupElement.classList.add(aPlace);
	},
	_resetPosition : function()
	{
		if ( ! this.popupElement && ! this.targetElement)
		{
			return;
		}

		let left, top, arrowPosition, centerLeft, centerRight, centerTop, centerBottom, place;
		let {offsetWidth : width, offsetHeight : height} = this.popupElement;
		let {offsetWidth : targetWidth, offsetHeight : targetHeight} = this.targetElement;
		let {left : clientLeft , top : clientTop} = this.targetElement.getBoundingClientRect()
		let {clientWidth, clientHeight} = document.documentElement;

		centerLeft = targetWidth / 2 + clientLeft;
		centerRight = clientWidth - centerLeft;
		centerTop = targetHeight / 2 + clientTop;
		centerBottom = clientHeight - centerTop;

		if (width >= height)
		{
			if (clientTop >= height) place = 'top';
			else if (clientHeight - clientTop - targetHeight >= height) place = 'bottom';
			else if (clientLeft >= width) place = 'left';
			else if (clientWidth - clientLeft - targetWidth >= width) place = 'right';
		}
		else
		{
			if (centerLeft >= width) place = 'left';
			else if (centerRight >= width) place = 'right';
			else if (centerTop >= height) place = 'top';
			else if (centerBottom >= height) place = 'bottom';
		}

		switch (place)
		{
			case 'top':
				top = Math.min(Math.max(this.boxShadowBlur, clientTop - height), centerTop - height);
				break;

			case 'bottom':
				top = Math.max(Math.min(clientHeight - height - this.boxShadowBlur, clientTop + targetHeight), centerTop);
				break;

			case 'left':
				left = Math.min(Math.max(this.boxShadowBlur, clientLeft - width), centerLeft - width);
				break;

			case 'right':
				left = Math.max(Math.min(clientWidth - width - this.boxShadowBlur, clientLeft + targetWidth), centerLeft);
				break;
		}

		if (place == 'top' || place == 'bottom')
		{

			left = Math.min(Math.max(centerLeft - (width / 2 + this.boxShadowBlur), this.boxShadowBlur), clientWidth - width - this.boxShadowBlur);
			arrowPosition = centerLeft - left - this.boxShadowBlur;
		}
		else
		{
			top = Math.min(Math.max(centerTop - (height / 2 + this.boxShadowBlur), this.boxShadowBlur), clientHeight - height - this.boxShadowBlur);
			arrowPosition = centerTop - top - this.boxShadowBlur;
		}

		this.popupElement.style.left = Math.round(left) + 'px';
		this.popupElement.style.top = Math.round(top) + 'px';
		this._resetArrow(place, arrowPosition);
	},
	show : function(aPopupElement, aTargetElement)
	{
		if (this.popupElement == aPopupElement && this.targetElement == aTargetElement)
		{
			this._resetPosition();
			return;
		}

		this.hide();

		this.popupElement = aPopupElement;
		this.targetElement = aTargetElement;
		this._resetPosition();

		this.popupElement.classList.add('active');
		this.targetElement.classList.add('active');
	},
	hide : function()
	{
		if ( ! this.popupElement && ! this.targetElement) return;

		Array.prototype.forEach.call(this.popupElement.querySelectorAll('textbox'), function(aTextbox) aTextbox.blur());

		this.popupElement.classList.remove('active');
		this.targetElement.classList.remove('active');
		this.popupElement = null;
		this.targetElement = null;
	},
	init : function()
	{
		this.styleSheet = document.getElementById('style');

		window.addEventListener('resize', function()
		{
			this._resetPosition();
		}.bind(this), false);

		scrollbox.addEventListener('scroll', function()
		{
			this.hide();
		}.bind(this), false);

		return this;
	}
};