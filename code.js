// Copyright 2023, Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const NOT_AVAILABLE = 0;

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24; /** this variable is used to calculate the date ranges passed to the API */

const REPORTING_OPTIONS = {
  // Comment out the following line to default to the latest reporting version.
  apiVersion: 'v18'
};


const SPREADSHEET_VARIABLES = {
  SPREADSHEET_URL : "YOUR_SPREADSHEET_URL",
  CONFIG_SHEET_NAME: 'Configuration',
  CAMPAIGN_SHEET_NAME: 'Campaign_information',
  CAMPAIGN_SHEET_HEADER: ['Account', 'Campaign', 'Bidding Strategy']
};


const QUERY_VARIABLES = {
  DATE_FORMAT : 'yyyyMMdd'
};

/**
 * Entry point of the script.
 *
 */
function main() {
  cleanSpreadsheet( SPREADSHEET_VARIABLES.CAMPAIGN_SHEET_NAME, SPREADSHEET_VARIABLES.CAMPAIGN_SHEET_HEADER );

  if ( isMatchTypeProcessing() ) {
    Logger.log('Processing Match Type');
    matchTtyeComparison();
  }
  else {
    Logger.log('Processing Search Term');
    searchTermComparison();
  }

}


/**
 * For each record stored in campaignStrategyMap, this stores account-campaing-bidding strategy to the spreadsheet .
 *
 * @param {!object} campaignStrategyMap: Main object that account -> [campaigns] -> bid strategy
 */
function writeCampaignStrategyInSpreadSheet( campaignStrategyMap ) {
  if ( !campaignStrategyMap || Object.keys(campaignStrategyMap).length < 1 ) {
    Logger.log('No records provided');
    return;
  }
  const sheet = getSheet( SPREADSHEET_VARIABLES.CAMPAIGN_SHEET_NAME );
  // sheet.getRange(sheet.getLastRow() + 1, 1, records.length, records[0].length).setValues( records );
  const rowsToStore = []
  let rowIndex = sheet.getLastRow();
  for( const account in campaignStrategyMap ) {
    for( const campaign in campaignStrategyMap[account] ) {
      const record = [ account, campaign, campaignStrategyMap[account][campaign] ] ;
      rowsToStore.push(record);   
    }
  }
  if(rowsToStore.length > 0){
    sheet.getRange( 1 + sheet.getLastRow(), 1, rowsToStore.length, rowsToStore[0].length).setValues(rowsToStore);
  }
}

/**
 * Deletes all data from spreadsheet's given sheet name and re-creates the headers row.
 * @param {string} sheetName: Name of the sheet to retrieve
 * @param {string} headers: array containing the headers of the sheet
 *
 */
function cleanSpreadsheet( sheetName, headers){
  const sheet = getSheet( sheetName );

  sheet.clearContents();

  for ( let pos = 1; pos <= headers.length; pos ++ ) {
      sheet.getRange( 1, pos ).setValue( headers[pos - 1] ).setFontWeight('bold');
  }
}

/**
 * Returns the reference to the given tab in the spreadsheet located at SPREADSHEET_VARIABLES.SPREADSHEET_URL
 * If the sheet doesn't exists, it creates the sheet returns it.
 *
 * @param {string} sheetName: Name of the sheet to retrieve
 * @return {!object} Reference to the sheet configured in the properties.
 */
function getSheet( sheetName ){
  const spreadsheet = SpreadsheetApp.openByUrl( SPREADSHEET_VARIABLES.SPREADSHEET_URL );
  if(!spreadsheet.getSheetByName( sheetName )) {
    spreadsheet.insertSheet( sheetName );
  }
  return spreadsheet.getSheetByName( sheetName );
}



/**
 * Returns the date (start date or end date, according to the input parater rowNum)
 * from the spreadsheet located at SPREADSHEET_VARIABLES.SPREADSHEET_URL
 *
 * @param {number} rowNum: index of the row that contains the date to retrieve (2 for start date, 3 for end date)
 * @return {string} The date as text in yyyyMMdd format.
 */
function getDateFromSpreadsheet(rowNum){
  const spreadsheet = SpreadsheetApp.openByUrl( SPREADSHEET_VARIABLES.SPREADSHEET_URL );
  const myDate = spreadsheet.getSheetByName( SPREADSHEET_VARIABLES.CONFIG_SHEET_NAME ).getRange(rowNum, 2).getValue();
  const dateComponents = myDate.toString().split('.');

  return `${dateComponents[2]}${dateComponents[1].padStart(2, "0")}${dateComponents[0].padStart(2, "0")}`;
}



/**
 * Reads from the spreadsheet if the processing has to be Search Term of Match Type
 *
 * @return {!object} Reference to the sheet configured in the properties.
 */
function isMatchTypeProcessing(){
  const spreadsheet = SpreadsheetApp.openByUrl( SPREADSHEET_VARIABLES.SPREADSHEET_URL );
  return spreadsheet.getSheetByName( SPREADSHEET_VARIABLES.CONFIG_SHEET_NAME ).getRange(3, 2).getValue() === 'Match Type';
}


/**
 * Checks if current account where the script is running is MCC or not
 *
 * @return {boolean}
 */
function isThisAccountMCC () {
  return !!this.AdsManagerApp;
}

/**
 * Creates the where clause to retrieve only data from a certain period in time
 *
 * @return {string} Where clause for the main query
 */
function getTimeConstraint() {
  const dateRangeToStart = getDateFromSpreadsheet(1);
  const dateRangeToEnd = getDateFromSpreadsheet(2);
  Logger.log('StarDate: '+dateRangeToStart);
  Logger.log('EndDate: '+dateRangeToEnd);

  return  ` AND segments.date BETWEEN '${dateRangeToStart}' AND '${dateRangeToEnd}' `;
}


/**
 * Accpets a match type and a keyword. If the keyword uses the old broad match
 * type approach, it changes the match type to BROAD_LEGACY. Otherwise it just
 * parses them into an object.
 *
 * @param {string} keywordMatchType: match type of the keyword.
 * @param {string} keywordText: Actual keyword.
 * @return {!object} object containing the keyword (keywordText)
 * and the match type (keywordMatchType).
 */
function keywordMatchTypeLegacyFix(keywordMatchType, keywordText) {

  if ( keywordMatchType === 'BROAD' && !!keywordText && keywordText.startsWith('+') ) {
    keywordMatchType = 'BROAD_LEGACY';
    keywordText = keywordText.replace(/\+(\w)/g, '$1');
  }
  return {'keywordText': keywordText, 'keywordMatchType' : keywordMatchType};
}


/**
 * This function enriches the metrics of a keyword by adding dashboard specific
 * fields made by the cartesian product between metrics and match types.
 * The newly added metrics will be set to NOT_AVAILABLE variable unless they
 * are related to the specific match type of the keyword, in which case they
 * Will be set to the original value of the metrics.
 *
 * @param {!object} outputRecord: object that maps the keyword metrics
 * @return {!object} object containing the keyword enriched metrics.
 */
function enrichOutputRecord( outputRecord ) {

  // Init the variables [clicks, impressions, conversions, conversions_value and cost]
  // for phrase', 'broad', 'broad_legacy', 'exact'to NOT_AVAILABLE
  for ( const i of ['phrase', 'broad', 'broad_legacy', 'exact' ]) {
    outputRecord.metrics[`clicks_${i}`] = NOT_AVAILABLE;
    outputRecord.metrics[`impressions_${i}`] = NOT_AVAILABLE;
    outputRecord.metrics[`conversions_${i}`] = NOT_AVAILABLE;
    outputRecord.metrics[`conversions_value_${i}`] = NOT_AVAILABLE;
    outputRecord.metrics[`cost_${i}`] = NOT_AVAILABLE;
  }

  const target = outputRecord.keywordMatchType.toLowerCase();

  outputRecord.metrics[`clicks_${target}`] = outputRecord.clicks;
  outputRecord.metrics[`impressions_${target}`] = outputRecord.impressions;
  outputRecord.metrics[`conversions_${target}`] = outputRecord.conversions;
  outputRecord.metrics[`conversions_value_${target}`] = outputRecord.conversionValue;
  outputRecord.metrics[`cost_${target}`] = outputRecord.cost;

  return outputRecord;
}

/**
 * This function retrieves the value (parsed to the appropriate type) of a metric
 * from the given object.
 *
 * @param {!object} obj: Input object from thwere we want to retrieve a metric.
 * @param {string} metric: Name of the metric to be retrieved.
 * @param {!object} parseFunction: function to parse the metric value.
 * @return {!object} the metric value parsed.
 */
function getMetric( obj, metric, parseFunction ) {
  let metricValue = obj?.['metrics']?.[metric] || NOT_AVAILABLE;
  // Force metricValue to be of the desired type
  if( metricValue !== NOT_AVAILABLE ) {
    metricValue = parseFunction(metricValue);
  }
  return metricValue;
}

