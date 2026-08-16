const { normalizeTenureType } = require('./tenureType');

/**
 * Accessors for the common WhatsApp Cloud API webhook payload shape:
 * payload.entry[0].changes[0].value.messages[0]
 */
function getWebhookValue(payload) {
  return payload?.entry?.[0]?.changes?.[0]?.value;
}

function getWebhookMessage(payload) {
  return getWebhookValue(payload)?.messages?.[0];
}

function normalizeFlowFieldName(fieldName) {
  if (fieldName === undefined || fieldName === null) return '';
  return String(fieldName)
    .trim()
    .toLowerCase()
    .replace(/[\s\-()]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Normalize a WhatsApp Flow submission payload (array of field entries or a
 * plain object, possibly nested under `fields` / `field_data`) into a flat
 * key/value object. When `normalizeKeys` is true, keys are lowercased and
 * stripped of separators via `normalizeFlowFieldName`.
 */
function normalizeFlowData(rawData, { normalizeKeys = false } = {}) {
  if (!rawData || typeof rawData !== 'object') return {};

  if (Array.isArray(rawData)) {
    return rawData.reduce((acc, item) => {
      if (!item || typeof item !== 'object') return acc;

      const key =
        item.name ||
        item.id ||
        item.field ||
        item.field_name ||
        item.field_id ||
        item.label ||
        item.label_name ||
        item?.metadata?.name ||
        item?.payload?.name ||
        item.type;

      let value = item.value ?? item.text ?? item?.payload?.text ?? item?.payload?.value;
      if (value && typeof value === 'object') {
        value = value.text ?? value.value ?? value.display_text ?? value.number ?? JSON.stringify(value);
      }

      if (key && value !== undefined) {
        acc[normalizeKeys ? normalizeFlowFieldName(key) : key] = value;
      }
      return acc;
    }, {});
  }

  if (rawData.fields) {
    return normalizeFlowData(rawData.fields, { normalizeKeys });
  }

  if (rawData.field_data) {
    return normalizeFlowData(rawData.field_data, { normalizeKeys });
  }

  if (!normalizeKeys) return rawData;

  return Object.entries(rawData).reduce((acc, [key, value]) => {
    acc[normalizeFlowFieldName(key)] = value;
    return acc;
  }, {});
}

// Known aliases for each submission field, covering snake_case, camelCase,
// and the collapsed lowercase forms produced by normalizeFlowFieldName.
const SUBMISSION_FIELD_ALIASES = {
  plot_number: [
    'plot_number', 'plotNumber', 'plotnumber', 'plot',
    'plot_farm_number', 'plotFarmNumber', 'plotfarmnumber',
    'title_deed', 'titleDeed', 'titledeed', 'deed',
  ],
  first_name: [
    'first_name', 'firstName', 'firstname',
    'given_name', 'givenName', 'givenname',
    'name_first', 'nameFirst', 'namefirst',
  ],
  last_name: [
    'last_name', 'lastName', 'lastname',
    'family_name', 'familyName', 'familyname',
    'name_last', 'nameLast', 'namelast',
  ],
  full_name: [
    'name', 'full_name', 'fullName', 'fullname',
    'owner_name', 'ownerName', 'ownername',
    'contact_name', 'contactName', 'contactname',
  ],
  farm_name: ['farm_name', 'farmName', 'farmname'],
  gender: ['gender', 'sex'],
  national_id: [
    'national_id', 'nationalId', 'nationalid',
    'id_number', 'idNumber', 'idnumber',
    'identification_farm_id', 'identificationFarmId', 'identificationfarmid',
    'identification', 'farm_id', 'farmId', 'farmid',
  ],
  province: ['province', 'province_name', 'provinceName', 'provincename'],
  district: ['district', 'district_name', 'districtName', 'districtname'],
  tenure_type: [
    'tenure_type', 'tenureType', 'tenuretype',
    'farm_particulars_tenure_type', 'farmParticularsTenureType', 'farmparticularstenuretype',
  ],
  tenure_type_other: [
    'tenure_type_other', 'tenureTypeOther', 'tenuretypeother',
    'other_tenure_type', 'otherTenureType', 'othertenuretype',
  ],
};

const WA_ID_ALIASES = ['wa_id', 'phone', 'phone_number', 'tel'];

/**
 * Return the first truthy value among the given aliases, checking direct
 * keys on `data` first, then keys nested under `data.fields`.
 */
function pickField(data, aliases) {
  if (!data || typeof data !== 'object') return null;

  for (const alias of aliases) {
    if (data[alias]) return data[alias];
  }

  const fields = data.fields;
  if (fields && typeof fields === 'object') {
    for (const alias of aliases) {
      if (fields[alias]) return fields[alias];
    }
  }

  return null;
}

/**
 * Extract the known land-submission fields from a normalized flow data
 * object, resolving all known aliases for each field.
 */
function extractSubmissionFields(data) {
  return {
    plot_number: pickField(data, SUBMISSION_FIELD_ALIASES.plot_number),
    first_name: pickField(data, SUBMISSION_FIELD_ALIASES.first_name),
    last_name: pickField(data, SUBMISSION_FIELD_ALIASES.last_name),
    full_name: pickField(data, SUBMISSION_FIELD_ALIASES.full_name),
    farm_name: pickField(data, SUBMISSION_FIELD_ALIASES.farm_name),
    gender: pickField(data, SUBMISSION_FIELD_ALIASES.gender),
    national_id: pickField(data, SUBMISSION_FIELD_ALIASES.national_id),
    province: pickField(data, SUBMISSION_FIELD_ALIASES.province),
    district: pickField(data, SUBMISSION_FIELD_ALIASES.district),
    tenure_type: normalizeTenureType(pickField(data, SUBMISSION_FIELD_ALIASES.tenure_type)),
    tenure_type_other: normalizeTenureType(pickField(data, SUBMISSION_FIELD_ALIASES.tenure_type_other)),
  };
}

function extractContactWaId(data) {
  return pickField(data, WA_ID_ALIASES);
}

module.exports = {
  getWebhookValue,
  getWebhookMessage,
  normalizeFlowFieldName,
  normalizeFlowData,
  pickField,
  extractSubmissionFields,
  extractContactWaId,
};
