/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

'use strict';

Launchpad.dialpad =
{
	element : null,
	current : null,

	resetCurrent : function()
	{
		let {clientWidth, clientHeight} = document.documentElement;

		this.current = getElementDimensions(this.element);

		this.current.availableWidth  = clientWidth -
		                               this.current.borderLeftWidth - this.current.borderRightWidth -
		                               this.current.paddingLeft - this.current.paddingRight -
		                               this.current.marginLeft - this.current.marginRight;
		this.current.availableHeight = clientHeight -
		                               this.current.borderTopWidth - this.current.borderBottomWidth -
		                               this.current.paddingTop - this.current.paddingBottom -
		                               this.current.marginTop - this.current.marginBottom;
		this.current.availableArea   = this.current.availableWidth * this.current.availableHeight;
	},

	init : function()
	{
		this.element = document.getElementById(DIALPAD_ID);
		this.resetCurrent();
	}
}