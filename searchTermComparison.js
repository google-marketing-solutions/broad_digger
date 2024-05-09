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

// SEARCH TERMS

const QUERY_VARIABLES_SEARCH_TERM = {
  SELECT : ' SELECT search_term_view.search_term,  campaign.bidding_strategy_type, segments.keyword.info.text, segments.keyword.info.match_type, campaign.name, campaign.id, metrics.impressions, metrics.conversions, metrics.clicks, metrics.conversions_value, metrics.average_cost FROM search_term_view',
  WHERE : ' WHERE segments.keyword.info.text != "" AND metrics.clicks > 0 ',
  ORDER : ' ORDER BY campaign.id, segments.keyword.info.text, segments.keyword.info.match_type '
};



const SPREADSHEET_VARIABLES_SEARCH_TERM = {
  SPREADSHEET_OUTPUT_HEADER :   [ 'Account Name', 'Campaign Name', 'Keyword', 'Search term',
    'Clicks BROAD', 'Impressions BROAD', 'Conversions BROAD',  'Conversion Value BROAD', 'Cost BROAD',
    'Clicks EXACT', 'Impressions EXACT', 'Conversions EXACT',  'Conversion Value EXACT', 'Cost EXACT',
    'Clicks BROAD LEGACY', 'Impressions BROAD LEGACY', 'Conversions BROAD LEGACY',  'Conversion Value BROAD LEGACY', 'Cost BROAD LEGACY',
    'Clicks PHRASE', 'Impressions PHRASE', 'Conversions PHRASE',  'Conversion Value PHRASE', 'Cost PHRASE' ],
  OUTPUT_SHEET_NAME : 'searchTermComparison',
};



const SPREADSHEET_VARIABLES_SEARCH_TERM_CUSTOM = {
  SPREADSHEET_OUTPUT_HEADER :   [ 'Search term',
    'Clicks BROAD', 'Impressions BROAD', 'Conversions BROAD',  'Conversion Value BROAD', 'Cost BROAD',
    'Clicks EXACT', 'Impressions EXACT', 'Conversions EXACT',  'Conversion Value EXACT', 'Cost EXACT',
    'Clicks BROAD LEGACY', 'Impressions BROAD LEGACY', 'Conversions BROAD LEGACY',  'Conversion Value BROAD LEGACY', 'Cost BROAD LEGACY',
    'Clicks PHRASE', 'Impressions PHRASE', 'Conversions PHRASE',  'Conversion Value PHRASE', 'Cost PHRASE' ],
  OUTPUT_SHEET_NAME : 'searchTermComparisonAggregated',
};


/**
 * Entry point for search term processing.
 *
 */
function searchTermComparison() {

  Logger.log('Begin processing.');

  cleanSpreadsheet( SPREADSHEET_VARIABLES_SEARCH_TERM.OUTPUT_SHEET_NAME, SPREADSHEET_VARIABLES_SEARCH_TERM.SPREADSHEET_OUTPUT_HEADER );
  cleanSpreadsheet( SPREADSHEET_VARIABLES_SEARCH_TERM_CUSTOM.OUTPUT_SHEET_NAME, SPREADSHEET_VARIABLES_SEARCH_TERM_CUSTOM.SPREADSHEET_OUTPUT_HEADER );

  Logger.log('Cleanup previous data completed.');

  if( isThisAccountMCC() ) {
    processMCCaccountSearchTerm();
  }
  else {
    processSingleAccountSearchTerm();
  }

  Logger.log('Execution completed.');
}


/**
 * Process every sub account of and MCC account, storing their data inside searchTerm
 *
 */
function processMCCaccountSearchTerm(){

  // Get Accounts Iterator
  const accountIterator = AdsManagerApp.accounts().get();

  // Iterate over subaccounts
  while ( accountIterator.hasNext() ) {

    const currentAccount = accountIterator.next();
    AdsManagerApp.select( currentAccount );

    // Get records for current account
    processSingleAccountSearchTerm( currentAccount.getCustomerId() );
  }
}

/**
 * Process a single account storing its data inside searchTerm
 *
 */
function processSingleAccountSearchTerm( ) {

  const accountName =  AdsApp.currentAccount().getCustomerId();

  const searchTerm = { };
  searchTerm[accountName] = {};

  const custom = { };

  const QUERY_TIME_CONDITION = getTimeConstraint();
  const QUERY_KEYWORD_CONDITION = getKeywordCondition();

  const QUERY = `${QUERY_VARIABLES_SEARCH_TERM.SELECT} ${QUERY_VARIABLES_SEARCH_TERM.WHERE} ${QUERY_TIME_CONDITION} ${QUERY_KEYWORD_CONDITION} ${QUERY_VARIABLES_SEARCH_TERM.ORDER} `;
  const searchTermAdGroupIterator = AdsApp.search(QUERY , REPORTING_OPTIONS );

  Logger.log(QUERY);

  // Iterate over all ad Groups of current account
  while ( searchTermAdGroupIterator.hasNext() ) {
    let currentSearchTermAdGroup = searchTermAdGroupIterator.next();

    const outputRecord = createOutputRecordSearchTerm( currentSearchTermAdGroup );
    addResultEntrySearchTerm( searchTerm[accountName], outputRecord );
    addResultEntrySearchTermCustom( custom, outputRecord );

  } // End of iteration over campaigns

  writeRecordsInSpreadSheetSearchTerm( searchTerm );
  writeRecordsInCustomSpreadSheetSearchTerm( custom );

  Logger.log(`Completed proccessing for account ${accountName} `);
}


/**
 * Adds result to searchTerm as nested properties. We are using this appraoch in order to simplify the aggregation of the keywords data.
 *
 * @param {!object} searchTerm: Main object that contains, as properties the data of the users keywords
 * @param {!object} outputRecord: current search Term in the ad group being processed
 */
function addResultEntrySearchTerm( searchTerm, outputRecord ){

  // Add campaign to output obj if missing
  if(!searchTerm[outputRecord.campaignName]){
    searchTerm[outputRecord.campaignName] = {};
  }

  // Add keyword to output obj if missing
  if( !searchTerm[outputRecord.campaignName][outputRecord.keywordText]){
    searchTerm[outputRecord.campaignName][outputRecord.keywordText] = {};
  }

  // Add Search Term to output obj if missing
  if(!searchTerm[outputRecord.campaignName][outputRecord.keywordText][outputRecord.searchTerm]){
    searchTerm[outputRecord.campaignName][outputRecord.keywordText][outputRecord.searchTerm] = outputRecord.metrics;
    searchTerm[outputRecord.campaignName][outputRecord.keywordText][outputRecord.searchTerm]['matchType'] = [outputRecord.keywordMatchType];
  }
  else {
    for ( const metric in outputRecord.metrics ) {
      if( searchTerm[outputRecord.campaignName][outputRecord.keywordText][outputRecord.searchTerm][metric] !== NOT_AVAILABLE && outputRecord.metrics[metric] !== NOT_AVAILABLE ) {

        searchTerm[outputRecord.campaignName][outputRecord.keywordText][outputRecord.searchTerm][metric] += outputRecord.metrics[metric];
      }
    }
    searchTerm[outputRecord.campaignName][outputRecord.keywordText][outputRecord.searchTerm]['matchType'].push(outputRecord.keywordMatchType);
  }
}



/**
 * Adds result to custom as nested properties. We are using this appraoch in order to simplify the aggregation of the keywords data.
 *
 * @param {!object} custom: Main object that contains, as properties the data of the users keywords
 * @param {!object} outputRecord: current search Term in the ad group being processed
 */
function addResultEntrySearchTermCustom( custom, outputRecord ){

  // Add campaign to output obj if missing
  if(!custom[outputRecord.searchTerm]){
    custom[outputRecord.searchTerm] = outputRecord.metrics;
  }
  else {
    for ( const metric in outputRecord.metrics ) {
      if( custom[outputRecord.searchTerm][metric] !== NOT_AVAILABLE && outputRecord.metrics[metric] !== NOT_AVAILABLE ) {
        custom[outputRecord.searchTerm][metric] += outputRecord.metrics[metric];
      }
    }
  }
}


/**
 * Parser function of the Search Term to be printed as a record in the spreadsheet.
 * Used in the "standard" report and aggregated at Account, campaign, keyword and Search Term level.
 *
 * @param {!object} currentElement: object containing every metric for the current Search Term.
 * @param {string} account: Name of the account.
 * @param {string} campaign: Name of the campaign.
 * @param {string} keywordText: Keyword.
 * @param {string} searchTerm: current Search Term.
 * @return {!object} array ready to be used in the spreadsheet.
 */
function entryToSpreadsheetRecordSearchTerm( currentElement, account, campaign, keywordText, searchTerm ) {
  return [ account, // 'Account Name'
           campaign, // 'Campaign Name'
           keywordText, // 'Keyword'
           searchTerm, // 'Search Term
           currentElement['clicks_broad'],
           currentElement['impressions_broad'],
           currentElement['conversions_broad'],
           currentElement['conversions_value_broad'],
           currentElement['cost_broad'],

           currentElement['clicks_exact'],
           currentElement['impressions_exact'],
           currentElement['conversions_exact'],
           currentElement['conversions_value_exact'],
           currentElement['cost_exact'],

           currentElement['clicks_broad_legacy'],
           currentElement['impressions_broad_legacy'],
           currentElement['conversions_broad_legacy'],
           currentElement['conversions_value_broad_legacy'],
           currentElement['cost_broad_legacy'],

           currentElement['clicks_phrase'],
           currentElement['impressions_phrase'],
           currentElement['conversions_phrase'],
           currentElement['conversions_value_phrase'],
           currentElement['cost_phrase']
          ];
}

/**
 * Parser function of the Search Term to be printed as a record in the spreadsheet.
 * Used in the "custom" report and aggregated only on at Search Term level.
 *
 * @param {!object} currentElement: object containing every metric for the current Search Term.
 * @param {string} searchTerm: current Search Term.
 * @return {!object} array ready to be used in the spreadsheet.
 */
function entryToCustomSpreadsheetRecordSearchTerm( currentElement, searchTerm ) {
  return [
           searchTerm, // 'Search Term
           currentElement['clicks_broad'],
           currentElement['impressions_broad'],
           currentElement['conversions_broad'],
           currentElement['conversions_value_broad'],
           currentElement['cost_broad'],

           currentElement['clicks_exact'],
           currentElement['impressions_exact'],
           currentElement['conversions_exact'],
           currentElement['conversions_value_exact'],
           currentElement['cost_exact'],

           currentElement['clicks_broad_legacy'],
           currentElement['impressions_broad_legacy'],
           currentElement['conversions_broad_legacy'],
           currentElement['conversions_value_broad_legacy'],
           currentElement['cost_broad_legacy'],

           currentElement['clicks_phrase'],
           currentElement['impressions_phrase'],
           currentElement['conversions_phrase'],
           currentElement['conversions_value_phrase'],
           currentElement['cost_phrase']
          ];
}


/**
 * given an adgroup it parses in an object that contains the required information
 * (campaign, bidding strategy, match type, keyword, search term and its metrics) and that will be enriched
 *
 * @param {!object} currentSearchTermAdGroup: current ad group that is being processed.
 * @return {!object} custom object that contains the Search Term releveant information.
 */
function processRecorSearchTerm(  currentSearchTermAdGroup ) {

  let keywordMatchType = currentSearchTermAdGroup?.['segments']?.['keyword']?.['info']?.['matchType'] || NOT_AVAILABLE;

  let keywordText = currentSearchTermAdGroup?.['segments']?.['keyword']?.['info']?.['text'] || NOT_AVAILABLE;

  // Fix match type for legacy
  let fixedLegacy = keywordMatchTypeLegacyFix(keywordMatchType, keywordText);
  keywordText = fixedLegacy.keywordText;
  keywordMatchType = fixedLegacy.keywordMatchType;

  const clicks = getMetric(currentSearchTermAdGroup, 'clicks', parseInt);
  const impressions = getMetric(currentSearchTermAdGroup, 'impressions', parseInt);
  const conversions = getMetric(currentSearchTermAdGroup, 'conversions', parseInt);
  const conversionValue = getMetric(currentSearchTermAdGroup, 'conversionsValue', parseFloat);
  const cost = ( getMetric(currentSearchTermAdGroup, 'averageCost', parseFloat)  / 1000000 ) * clicks;

  return {
    campaignName: currentSearchTermAdGroup?.['campaign']?.['name'] || NOT_AVAILABLE,
    biddingStrategy: currentSearchTermAdGroup?.['campaign']?.['biddingStrategyType'] || NOT_AVAILABLE,
    keywordMatchType: keywordMatchType,
    keywordText: keywordText,
    searchTerm: currentSearchTermAdGroup?.['searchTermView']?.['searchTerm'] || NOT_AVAILABLE,
    clicks: clicks,
    impressions: impressions,
    conversions: conversions,
    conversionValue: conversionValue,
    cost: cost,
    metrics: {
      segmentDate : currentSearchTermAdGroup?.['campaign']?.['segments']?.['date'] || NOT_AVAILABLE
    }
  };
}


/**
 * Parses the Search Term to be printed as a record in the spreadsheet
 *
 * @param {!object} currentSearchTermAdGroup: current ad group that is being processed.
 * @return {!object} custom object ready to be used in the spreadsheet.
 */
function createOutputRecordSearchTerm( currentSearchTermAdGroup ){

 const outputRecord = processRecorSearchTerm( currentSearchTermAdGroup );
 return enrichOutputRecord( outputRecord );
}


/**
 * Writes the values in the spreadsheet of the search term.
 *
 * @param {!object} custom: representation of the search term information.
 */
function  writeRecordsInCustomSpreadSheetSearchTerm( custom ){
  if ( !custom || Object.keys(custom).length < 1 ) {
    Logger.log('No records provided');
    return;
  }

  const sheet = getSheet( SPREADSHEET_VARIABLES_SEARCH_TERM_CUSTOM.OUTPUT_SHEET_NAME );
  // sheet.getRange(sheet.getLastRow() + 1, 1, records.length, records[0].length).setValues( records );
  let rowIndex = sheet.getLastRow();
  for( const searchTerm in custom ) {

    const spreadsheetCurrentRow = entryToCustomSpreadsheetRecordSearchTerm( custom[searchTerm], searchTerm  );

    sheet.getRange( ++rowIndex, 1, 1, spreadsheetCurrentRow.length).setValues( [ spreadsheetCurrentRow ] );
  }
}

/**
 * For each record stored in searchTerm, this function normalizes the average CPC and writes the results to the spreadsheet .
 *
 * @param {!object} searchTerm: Main object that contains, as properties the data of the users keywords
 */
function writeRecordsInSpreadSheetSearchTerm( searchTerm ) {

  if ( !searchTerm || Object.keys(searchTerm).length < 1 ) {
    Logger.log('No records provided');
    return;
  }

  const sheet = getSheet( SPREADSHEET_VARIABLES_SEARCH_TERM.OUTPUT_SHEET_NAME );

  let rowIndex = sheet.getLastRow();
  for( const account in searchTerm ) {
    for( const campaign in searchTerm[account] ) {
      for( const keywordText in searchTerm[account][campaign] ) {
          for( const searchTermValue in searchTerm[account][campaign][keywordText] ) {

            const spreadsheetCurrentRow = entryToSpreadsheetRecordSearchTerm( searchTerm[account][campaign][keywordText][searchTermValue], account, campaign, keywordText, searchTermValue );

            sheet.getRange( ++rowIndex, 1, 1, spreadsheetCurrentRow.length).setValues( [ spreadsheetCurrentRow ] );
          }
      }
    }
  }
}


/**
 * Reads from the spreadsheet if the processing has to be Search Term of Match Type
 *
 * @return {!object} Reference to the sheet configured in the properties.
 */
function getKeywordsToFilter(){
  const spreadsheet = SpreadsheetApp.openByUrl( SPREADSHEET_VARIABLES.SPREADSHEET_URL ).getSheetByName( SPREADSHEET_VARIABLES.CONFIG_SHEET_NAME );

  return spreadsheet.getRange(3, 2, spreadsheet.getMaxRows(), 1).getValues().filter( (k) => !!k[0] ).map( (k) => `'${k[0]}'`) ;
}

/**
 * Creates the AND clause to retrieve only data from the preselected subset of keywords
 *
 * @return {string} AND clause for the main query
 */
function getKeywordCondition() {
  const keywords = getKeywordsToFilter();
  return (!!keywords && keywords.length > 0) ? ` AND segments.keyword.info.text IN (${keywords}) ` : '';
}
