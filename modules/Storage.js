/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

'use strict';

Cu.import('resource://gre/modules/Services.jsm');

let connection, storageErrors = [];

let storageConnection =
{
	_bindParameter : function bindParameter(aStatement, aParams)
	{
		if ( ! aParams)
		{
			return;
		}

		if (Array.isArray(aParams))
		{
			for (let i = 0; i < aParams.length; i++)
			{
				if (Array.isArray(aParams[i]))
				{
					let params = aStatement.newBindingParamsArray();

					for (let j = 0; j < aParams[i].length; j++)
					{
						let bp = params.newBindingParams();
						bp.bindByIndex(i, aParams[i][j]);
						params.addParams(bp);
					}
					aStatement.bindParameters(params);
				}
				else if (typeof(aParams[i]) == 'object')
				{
					let type = Object.keys(aParams[i])[0];
					let value = aParams[i][type];

					switch (type)
					{
						case 'UTF8String':
							aStatement.bindUTF8StringParameter(i, value);
							break;

						case 'String':
							aStatement.bindStringParameter(i, value);
							break;

						case 'Double':
							aStatement.bindDoubleParameter(i, value);
							break;

						case 'Int32':
							aStatement.bindInt32Parameter(i, value);
							break;

						case 'Int64':
							aStatement.bindInt64Parameter(i, value);
							break;

						case 'Null':
							aStatement.bindNullParameter(i);
							break;

						case 'Blob':
							aStatement.bindBlobByIndex(i, value, value.length);
							break;

						default :
							aStatement.bindByIndex(i, value);
							break;
					}
				}
				else
				{
					aStatement.bindByIndex(i, aParams[i]);
				}
			}
			return;
		}

		if (aParams && typeof(aParams) == 'object')
		{
			for (let name in aParams)
			{
				if (Array.isArray(aParams[name]))
				{
					let params = aStatement.newBindingParamsArray();

					for (let i = 0; i < aParams[name].length; i++)
					{
						let bp = params.newBindingParams();
						bp.bindByName(name, aParams[name][i]);
						params.addParams(bp);
					}
					aStatement.bindParameters(params);
				}
				else
				{
					aStatement.bindByName(name, aParams[name]);
				}
			}
			return;
		}

		throw new Error('Invalid type for bound parameters. Expected Array or object. Got: ' + aParams);
	},

	execute : function(aQueryString, aParams, onRaw, aCallback)
	{
		let statement = connection.createStatement(aQueryString);
		this._bindParameter(statement, aParams);
		let result = [];
		let errors = [];
		statement.executeAsync(
		{
			handleResult: function(aResultSet)
			{
				for (let row = aResultSet.getNextRow(); row; row = aResultSet.getNextRow())
				{
					if (onRaw)
					{
						result = row;
						break;
					}
					else
					{
						result.push(row);
					}
				}
			},

			handleError: function(aError)
			{
				errors.push(aError);
			},

			handleCompletion: function(aReason)
			{
				switch (aReason)
				{
					case Ci.mozIStorageStatementCallback.REASON_FINISHED:
						break;

					case Ci.mozIStorageStatementCallback.REASON_CANCELLED:
						result = [];
						errors.push('Statement was cancelled.');
						break;

					case Ci.mozIStorageStatementCallback.REASON_ERROR:
						result = [];
						errors.push('Error(s) encountered during statement execution.');
						break;

					default:
						result = [];
						errors.push('Unknown completion reason code: ' + aReason);
						break;
				}

				if (errors.length)
				{
					aCallback && aCallback.onError && aCallback.onError(errors.join(' '));
				}
				else
				{
					if (onRaw)
					{
						result = Array.isArray(result) ? null : result;
					}
					aCallback && aCallback.onResult && aCallback.onResult(result);
				}
				statement.finalize();
			}
		});
	},

	tableExists : function(aName, aCallback)
	{
		let exists, error;

		try
		{
			exists = connection.tableExists(aName)
		}
		catch (e)
		{
			error = e;
		}

		if (error)
		{
			aCallback && aCallback.onError && aCallback.onError(error);
		}
		else
		{
			aCallback && aCallback.onResult && aCallback.onResult(exists);
		}
	},

	createTable : function(aName, aSchema, aCallback)
	{
		let exists, error;

		try
		{
			connection.createTable(aName, aSchema);
		}
		catch (e)
		{
			error = 'Cannot creat table \'' + aName + '\' (' + aSchema + '). ' + e;
		}

		if (error)
		{
			aCallback && aCallback.onError && aCallback.onError(error);
		}
		else
		{
			aCallback && aCallback.onSuccess && aCallback.onSuccess();
		}
	},

	close : function(aCallback)
	{
		let error;

		try
		{
			connection.close();
			connection = null;
		}
		catch (e)
		{
			error = 'An error occured on closing the connection. ' + e;
		}

		if (error)
		{
			aCallback && aCallback.onError && aCallback.onError(error);
		}
		else
		{
			aCallback && aCallback.onSuccess && aCallback.onSuccess();
		}
	}
};

exports.Storage =
{
      openConnection : function(aFile, aCallback)
      {
              try
              {
	              connection = Services.storage.openDatabase(aFile);
              }
              catch (e)
              {
	              storageErrors.push('Cannot open database file. ' + e);
              }

              if (storageErrors.length)
              {
	              aCallback && aCallback.onError && aCallback.onError(storageErrors.join(' '));
              }
              else
              {
	              aCallback && aCallback.onSuccess && aCallback.onSuccess(this.connection);
              }
      },
      connection : new Proxy(storageConnection,
      {
	      get : function (aTarget, aName)
	      {
		      if ( ! connection || ! (aName in aTarget))
		      {
			      return undefined;
		      }

		      return aTarget[aName];
	      }
      })
};
