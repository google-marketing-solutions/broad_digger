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

const QUERY_VARIABLES_MATCH_TYPE = {
  SELECT : ' SELECT campaign.bidding_strategy_type, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, campaign.name, campaign.id, metrics.impressions, metrics.conversions, metrics.clicks, metrics.conversions_value, metrics.average_cost FROM keyword_view ',
  WHERE : ' WHERE ad_group_criterion.keyword.text != "" AND metrics.impressions > 0 ',
  ORDER : ' ORDER BY campaign.id, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type '
};

const SPREADSHEET_VARIABLES_MATCH_TYPE = {
  SPREADSHEET_OUTPUT_HEADER :   [ 'Account Name', 'Campaign Name', 'Keyword',
    'Clicks BROAD', 'Impressions BROAD', 'Conversions BROAD',  'Conversion Value BROAD', 'Cost BROAD',
    'Clicks EXACT', 'Impressions EXACT', 'Conversions EXACT',  'Conversion Value EXACT', 'Cost EXACT',
    'Clicks BROAD LEGACY', 'Impressions BROAD LEGACY', 'Conversions BROAD LEGACY',  'Conversion Value BROAD LEGACY', 'Cost BROAD LEGACY',
    'Clicks PHRASE', 'Impressions PHRASE', 'Conversions PHRASE',  'Conversion Value PHRASE', 'Cost PHRASE' ],
  OUTPUT_SHEET_NAME : 'matchTypeComparison',
};

const SPREADSHEET_VARIABLES_MATCH_TYPE_AGGREGATED = {
  SPREADSHEET_OUTPUT_HEADER :   [ 'Account Name', 'Campaign Name', 'Keyword', 'Match Type', 'Bidding Strategy',
    'Clicks', 'Impressions', 'Conversions',  'Conversion Value', 'Cost' ],
  OUTPUT_SHEET_NAME : 'matchTypeComparisonAggregated',
};

const SPREADSHEET_VARIABLES_MATCH_TYPE_CUSTOM = {
  SPREADSHEET_OUTPUT_HEADER :   [ 'Account Name', 'Campaign Name', 'Keyword', 'Match Type', 'Bidding Strategy',
    'Clicks', 'Impressions', 'Conversions',  'Conversion Value', 'Cost' ],
  OUTPUT_SHEET_NAME : 'matchTypeComparisonCustom',
};


/**
 * Process the match type script. It extracts each keyword of the account and subaccounts,
 * then it splits them by match type and writes the metrics on the spreadsheet.
 */
function matchTtyeComparison() {

  Logger.log('Begin processing.');

  cleanSpreadsheet( SPREADSHEET_VARIABLES_MATCH_TYPE.OUTPUT_SHEET_NAME, SPREADSHEET_VARIABLES_MATCH_TYPE.SPREADSHEET_OUTPUT_HEADER );
  cleanSpreadsheet( SPREADSHEET_VARIABLES_MATCH_TYPE_AGGREGATED.OUTPUT_SHEET_NAME, SPREADSHEET_VARIABLES_MATCH_TYPE_AGGREGATED.SPREADSHEET_OUTPUT_HEADER );
  cleanSpreadsheet( SPREADSHEET_VARIABLES_MATCH_TYPE_CUSTOM.OUTPUT_SHEET_NAME, SPREADSHEET_VARIABLES_MATCH_TYPE_CUSTOM.SPREADSHEET_OUTPUT_HEADER );

  Logger.log('Cleanup previous data completed.');

  if( isThisAccountMCC() ) {
    processMCCaccountMatchType( );
  }
  else {
    processSingleAccountMatchType( );
  }

  Logger.log('Execution completed.');
}

/**
 * Process every sub account of and MCC account, storing their data inside mainObj
 *
 */
function processMCCaccountMatchType( ){

  // Get Accounts Iterator
  const accountIterator = AdsManagerApp.accounts().get();

  // Iterate over subaccounts
  while ( accountIterator.hasNext() ) {

    const currentAccount = accountIterator.next();
    AdsManagerApp.select( currentAccount );

    // Get records for current account
    processSingleAccountMatchType();

  }
}

/**
 * Process a single account storing its data inside mainObj
 *
 */
function processSingleAccountMatchType() {

  const accountName =  AdsApp.currentAccount().getCustomerId();

  const matchType = { };
  matchType[accountName] = {};

  const custom = { };
  custom[accountName] = {};

  const campaignStrategyMap = { };
  campaignStrategyMap[accountName] = {};


  const QUERY_TIME_CONDITION = getTimeConstraint();

  const QUERY = `${QUERY_VARIABLES_MATCH_TYPE.SELECT} ${QUERY_VARIABLES_MATCH_TYPE.WHERE} ${QUERY_TIME_CONDITION} ${QUERY_VARIABLES_MATCH_TYPE.ORDER} `;
  const keywordAdGroupIterator = AdsApp.search(QUERY , REPORTING_OPTIONS );

  Logger.log(QUERY);

  // Iterate over all ad Groups of current account
  while ( keywordAdGroupIterator.hasNext() ) {
    let currentKeywordAdGroup = keywordAdGroupIterator.next();

    const outputRecord = createOutputRecordMatchType( currentKeywordAdGroup );

    addResultEntryMatchType( matchType[accountName], outputRecord );
    addResultEntryCustom( custom[accountName], outputRecord );

    campaignStrategyMap[accountName][outputRecord.campaignName] = outputRecord.biddingStrategy;

  } // End of iteration over campaigns

  // Add to the spreadsheet the records
  writeRecordsInSpreadSheetMatchType( matchType );
  writeAggregated( campaignStrategyMap );
  writeRecordsInSpreadSheetCustom( custom );

  Logger.log(`Completed proccessing for account ${accountName} `);
}


/**
 * given an adgroup it parses in an object that contains the required information
 * (campaign, bidding strategy, match type and keyword) and that will be enriched
 *
 * @param {!object} currentKeywordAdGroup: current ad group that is being processed.
 * @return {!object} custom object that contains the keyword releveant information.
 */
function processRecordMatchType( currentKeywordAdGroup ) {
  let keywordMatchType = currentKeywordAdGroup?.['adGroupCriterion']?.['keyword']?.['matchType'] || NOT_AVAILABLE;

  let keywordText = currentKeywordAdGroup?.['adGroupCriterion']?.['keyword']?.['text'] || NOT_AVAILABLE;

  let fixedLegacy = keywordMatchTypeLegacyFix(keywordMatchType, keywordText);
  keywordText = fixedLegacy.keywordText;
  keywordMatchType = fixedLegacy.keywordMatchType;

  return {
    campaignName: currentKeywordAdGroup?.['campaign']?.['name'] || NOT_AVAILABLE,
    biddingStrategy: currentKeywordAdGroup?.['campaign']?.['biddingStrategyType'] || NOT_AVAILABLE,
    keywordMatchType: keywordMatchType,
    keywordText: keywordText,
    metrics: {}
  };
}


/**
 * Enriches the given keyword information with metrics
 *
 * @param {!object} currentKeywordAdGroup: current ad group that is being processed.
 * @return {!object} enriched keyword object with metrics.
 */
function prepareOutputRecord( currentKeywordAdGroup ) {
  const outputRecord = processRecordMatchType( currentKeywordAdGroup );

  outputRecord.clicks = getMetric(currentKeywordAdGroup, 'clicks', parseInt);
  outputRecord.impressions = getMetric(currentKeywordAdGroup, 'impressions', parseInt);
  outputRecord.conversions = getMetric(currentKeywordAdGroup, 'conversions', parseInt);
  outputRecord.conversionValue = getMetric(currentKeywordAdGroup, 'conversionsValue', parseFloat);
  outputRecord.cost = ( getMetric(currentKeywordAdGroup, 'averageCost', parseFloat)  / 1000000 ) * outputRecord.clicks;

  return outputRecord;
}

/**
 * Parses the keyword to be printed as a record in the spreadsheet
 *
 * @param {!object} currentKeywordAdGroup: current ad group that is being processed.
 * @return {!object} custom object ready to be used in the spreadsheet.
 */
function createOutputRecordMatchType( currentKeywordAdGroup ){
  const outputRecord = prepareOutputRecord(currentKeywordAdGroup);
  return enrichOutputRecord( outputRecord );
}


/**
 * Adds result to mainObj as nested properties. We are using this appraoch in order to simplify the aggregation of the keywords data.
 *
 * @param {string} matchType: Match type of the keyword
 * @param {!object} outputRecord: object that mappes all the records 
 */
function addResultEntryMatchType( matchType, outputRecord ) {

  // Add campaign to matchType obj if missing
  if(!matchType[outputRecord.campaignName]){
    matchType[outputRecord.campaignName] = {};
  }

  // Add keyword to output obj if missing
  if( !matchType[outputRecord.campaignName][outputRecord.keywordText]){
    matchType[outputRecord.campaignName][outputRecord.keywordText] = outputRecord.metrics;
    matchType[outputRecord.campaignName][outputRecord.keywordText]['matchType'] = [outputRecord.keywordMatchType];
  }
  else {

    for ( const metric in outputRecord.metrics ) {
        matchType[outputRecord.campaignName][outputRecord.keywordText][metric] += outputRecord.metrics[metric];
    }
    if (  matchType[outputRecord.campaignName][outputRecord.keywordText]['matchType'].indexOf(outputRecord.keywordMatchType) === -1 ) {
      matchType[outputRecord.campaignName][outputRecord.keywordText]['matchType'].push(outputRecord.keywordMatchType);
    }
  }
}


/**
 * For each record stored in mainObj, this function normalizes the average CPC and writes the results to the spreadsheet .
 *
 * @param {!object} matchType: Main object that contains, as properties the data of the users keywords
 */
function writeRecordsInSpreadSheetMatchType( matchType ) {
  if ( !matchType || Object.keys(matchType).length < 1 ) {
    Logger.log('No records provided');
    return;
  }
  const sheet = getSheet( SPREADSHEET_VARIABLES_MATCH_TYPE.OUTPUT_SHEET_NAME );
  // sheet.getRange(sheet.getLastRow() + 1, 1, records.length, records[0].length).setValues( records );
  let rowIndex = sheet.getLastRow();
  for( const account in matchType ) {
    for( const campaign in matchType[account] ) {
      for( const keywordText in matchType[account][campaign] ) {

        const currentElement = matchType[account][campaign][keywordText];

        // Skip this keyword if it hasn't at least 2 match types
        if( !currentElement || currentElement.matchType.length < 2 ||
          currentElement.matchType.indexOf('BROAD') === -1 ) {
          continue;
        }

        const spreadsheetCurrentRow = [
           account, // 'Account Name'
           campaign, // 'Campaign Name'
           keywordText, // 'Keyword'
           // keywordMatchType, //'Match Type'
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

        sheet.getRange( ++rowIndex, 1, 1, spreadsheetCurrentRow.length).setValues( [ spreadsheetCurrentRow ] );
      }
    }
  }
}


/**
 * adds current keyword object to the map of all keywords
 *
 * @param {!object} custom:  map account -> campaign -> keyword -> match type -> metrics.
 * @param {!object} outputRecord: keyword data object.
 */
function addResultEntryCustom( custom, outputRecord ) {

  // Add campaign to output obj if missing
  if(!custom[outputRecord.campaignName]){
    custom[outputRecord.campaignName] = {};
  }

  // Add keyword to output obj if missing
  if( !custom[outputRecord.campaignName][outputRecord.keywordText]){
    custom[outputRecord.campaignName][outputRecord.keywordText] = { };
  }

  custom[outputRecord.campaignName][outputRecord.keywordText][outputRecord.keywordMatchType] = {
    clicks: outputRecord.clicks,
    impressions: outputRecord.impressions,
    conversions: outputRecord.conversions,
    conversionValue: outputRecord.conversionValue,
    cost: outputRecord.cost
  };
}

/**
 * Writes the values in the spreadsheet IF the given keyword has, for the its
 * account and campaign, at least 2 match types and one of them is 'BROAD'.
 *
 * @param {!object} custom object ready to be used in the spreadsheet.
 */
function writeRecordsInSpreadSheetCustom( custom ) {
  if ( !custom || Object.keys(custom).length < 1 ) {
    Logger.log('No records provided');
    return;
  }

  const sheetCustom = getSheet( SPREADSHEET_VARIABLES_MATCH_TYPE_CUSTOM.OUTPUT_SHEET_NAME );
  const sheetAggregated = getSheet( SPREADSHEET_VARIABLES_MATCH_TYPE_AGGREGATED.OUTPUT_SHEET_NAME );
  let rowIndexCustom = sheetCustom.getLastRow();
  let rowIndexAggregated = sheetAggregated.getLastRow();

  for( const account in custom ) {
    for( const campaign in custom[account] ) {
      for( const keywordText in custom[account][campaign] ) {
        for( const matchType in custom[account][campaign][keywordText] ) {

          const currentElement = custom[account][campaign][keywordText];

          const spreadsheetCurrentRow = [
            account,
            campaign,
            keywordText,
            matchType,
            currentElement[matchType].biddingStrategy,
            currentElement[matchType].clicks,
            currentElement[matchType].impressions,
            currentElement[matchType].conversions,
            currentElement[matchType].conversionValue,
            currentElement[matchType].cost
          ];

          sheetAggregated.getRange( ++rowIndexAggregated, 1, 1, spreadsheetCurrentRow.length).setValues( [ spreadsheetCurrentRow ] );

          // Skip this keyword if it hasn't at least 2 match types
          if( !currentElement|| Object.keys( currentElement ).length < 2 ||
            Object.keys( currentElement ).indexOf('BROAD') === -1 ) {
            continue;
          }
          sheetCustom.getRange( ++rowIndexCustom, 1, 1, spreadsheetCurrentRow.length).setValues( [ spreadsheetCurrentRow ] );
        }
      }
    }
  }
}

/**
 * Writes the information baout account, campaigns and bid strategies in the spreadsheet.
 * @param {!object} campaignStrategyMap: mapping of account -> campaign -> campaign strategy
 *
 */
function writeAggregated( campaignStrategyMap ) {
  if ( !campaignStrategyMap || Object.keys(campaignStrategyMap).length < 1 ) {
    Logger.log('No records provided');
    return;
  }

  const sheet = getSheet( SPREADSHEET_VARIABLES.CAMPAIGN_SHEET_NAME );
  let rowIndex = sheet.getLastRow();

  for( const account in campaignStrategyMap ) {
    for( const campaign in campaignStrategyMap[account] ) {
      const spreadsheetCurrentRow = [
        account,
        campaign,
        campaignStrategyMap[account][campaign]
      ];

      sheet.getRange( ++rowIndex, 1, 1, spreadsheetCurrentRow.length).setValues( [ spreadsheetCurrentRow ] );
    }
  }
}
