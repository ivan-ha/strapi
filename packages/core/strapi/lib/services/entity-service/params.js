'use strict';

const _ = require('lodash');
const { pick } = require('lodash/fp');

const {
  convertSortQueryParams,
  convertLimitQueryParams,
  convertStartQueryParams,
} = require('@strapi/utils/lib/convert-rest-query-params');

const { contentTypes: contentTypesUtils } = require('@strapi/utils');

const { PUBLISHED_AT_ATTRIBUTE } = contentTypesUtils.constants;

const transformParamsToQuery = (uid, params = {}) => {
  const model = strapi.getModel(uid);

  const query = {};

  // TODO: check invalid values add defaults ....

  const {
    start,
    page,
    pageSize,
    limit,
    sort,
    filters,
    fields,
    populate,
    publicationState,
    _q,
    _where,
    ...rest
  } = params;

  if (_q) {
    query._q = _q;
  }

  if (page) {
    query.page = Number(page);
  }

  if (pageSize) {
    query.pageSize = Number(pageSize);
  }

  if (start) {
    query.offset = convertStartQueryParams(start);
  }

  if (limit) {
    query.limit = convertLimitQueryParams(limit);
  }

  if (sort) {
    query.orderBy = convertSortQueryParams(sort);
  }

  if (filters) {
    query.where = filters;
  }

  if (_where) {
    query.where = {
      $and: [_where].concat(query.where || []),
    };
  }

  if (fields) {
    query.select = _.castArray(fields);
  }

  if (populate) {
    const { populate } = params;
    query.populate = typeof populate === 'object' ? populate : _.castArray(populate);
  }

  // TODO: move to layer above ?
  if (publicationState && contentTypesUtils.hasDraftAndPublish(model)) {
    const { publicationState = 'live' } = params;

    const liveClause = {
      [PUBLISHED_AT_ATTRIBUTE]: {
        $notNull: true,
      },
    };

    if (publicationState === 'live') {
      query.where = {
        $and: [liveClause].concat(query.where || []),
      };

      // TODO: propagate nested publicationState filter somehow
    }
  }

  const finalQuery = {
    ...convertOldQuery(rest),
    ...query,
  };

  return finalQuery;
};

// TODO: to remove once the front is migrated
const convertOldQuery = params => {
  const obj = {};

  Object.keys(params).forEach(key => {
    if (key.startsWith('_')) {
      obj[key.slice(1)] = params[key];
    } else {
      obj[key] = params[key];
    }
  });

  return obj;
};

const pickSelectionParams = pick(['fields', 'populate']);

module.exports = {
  transformParamsToQuery,
  pickSelectionParams,
};
