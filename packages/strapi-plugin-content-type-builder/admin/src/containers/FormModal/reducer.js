import { fromJS, List } from 'immutable';
import pluralize from 'pluralize';
import { snakeCase } from 'lodash';
import makeUnique from '../../utils/makeUnique';
import { createComponentUid } from './utils/createUid';
import { shouldPluralizeName, shouldPluralizeTargetAttribute } from './utils/relations';
import {
  ADD_COMPONENTS_TO_DYNAMIC_ZONE,
  ON_CHANGE,
  ON_CHANGE_ALLOWED_TYPE,
  RESET_PROPS,
  RESET_PROPS_AND_SET_FORM_FOR_ADDING_AN_EXISTING_COMPO,
  RESET_PROPS_AND_SAVE_CURRENT_DATA,
  RESET_PROPS_AND_SET_THE_FORM_FOR_ADDING_A_COMPO_TO_A_DZ,
  SET_DATA_TO_EDIT,
  SET_ATTRIBUTE_DATA_SCHEMA,
  SET_DYNAMIC_ZONE_DATA_SCHEMA,
  SET_ERRORS,
} from './constants';

const initialState = {
  formErrors: {},
  modifiedData: {},
  initialData: {},
  componentToCreate: {},
  isCreatingComponentWhileAddingAField: false,
};

const formModalReducer = (jsonState = initialState, action) => {
  const state = fromJS(jsonState);

  switch (action.type) {
    case ADD_COMPONENTS_TO_DYNAMIC_ZONE: {
      const { name, components, shouldAddComponents } = action;

      return state
        .updateIn(['modifiedData', name], list => {
          let updatedList = list;

          if (shouldAddComponents) {
            updatedList = list.concat(components);
          } else {
            updatedList = list.filter(comp => {
              return components.indexOf(comp) === -1;
            });
          }

          return List(makeUnique(updatedList.toJS()));
        })
        .toJS();
    }
    case ON_CHANGE:
      return state
        .update('modifiedData', obj => {
          const {
            selectedContentTypeFriendlyName,
            keys,
            value,
            oneThatIsCreatingARelationWithAnother,
          } = action;
          const hasDefaultValue = Boolean(obj.getIn(['default']));

          // There is no need to remove the default key if the default value isn't defined
          if (hasDefaultValue && keys.length === 1 && keys.includes('type')) {
            const previousType = obj.getIn(['type']);

            if (previousType && ['date', 'datetime', 'time'].includes(previousType)) {
              return obj.updateIn(keys, () => value).remove('default');
            }
          }

          if (keys.length === 1 && keys.includes('nature')) {
            return obj
              .update('nature', () => value)
              .update('dominant', () => {
                if (value === 'manyToMany') {
                  return true;
                }

                return null;
              })
              .update('name', oldValue => {
                return pluralize(snakeCase(oldValue), shouldPluralizeName(value));
              })
              .update('targetAttribute', oldValue => {
                if (['oneWay', 'manyWay'].includes(value)) {
                  return '-';
                }

                return pluralize(
                  oldValue === '-' ? snakeCase(oneThatIsCreatingARelationWithAnother) : oldValue,
                  shouldPluralizeTargetAttribute(value)
                );
              })
              .update('targetColumnName', oldValue => {
                if (['oneWay', 'manyWay'].includes(value)) {
                  return null;
                }

                return oldValue;
              });
          }

          if (keys.length === 1 && keys.includes('target')) {
            const { targetContentTypeAllowedRelations } = action;
            let didChangeNatureBecauseOfRestrictedRelation = false;

            return obj
              .update('target', () => value)
              .update('nature', currentNature => {
                if (targetContentTypeAllowedRelations === null) {
                  return currentNature;
                }

                if (!targetContentTypeAllowedRelations.includes(currentNature)) {
                  didChangeNatureBecauseOfRestrictedRelation = true;

                  return targetContentTypeAllowedRelations[0];
                }

                return currentNature;
              })
              .update('name', () => {
                if (didChangeNatureBecauseOfRestrictedRelation) {
                  return pluralize(
                    snakeCase(selectedContentTypeFriendlyName),
                    shouldPluralizeName(targetContentTypeAllowedRelations[0])
                  );
                }

                return pluralize(
                  snakeCase(selectedContentTypeFriendlyName),

                  shouldPluralizeName(obj.get('nature'))
                );
              })
              .update('targetAttribute', () => {
                if (['oneWay', 'manyWay'].includes(obj.get('nature'))) {
                  return '-';
                }

                if (
                  didChangeNatureBecauseOfRestrictedRelation &&
                  ['oneWay', 'manyWay'].includes(targetContentTypeAllowedRelations[0])
                ) {
                  return '-';
                }

                return pluralize(
                  snakeCase(oneThatIsCreatingARelationWithAnother),
                  shouldPluralizeTargetAttribute(obj.get('nature'))
                );
              });
          }

          return obj.updateIn(keys, () => value);
        })
        .toJS();
    case ON_CHANGE_ALLOWED_TYPE: {
      if (action.name === 'all') {
        return state
          .updateIn(['modifiedData', 'allowedTypes'], () => {
            if (action.value) {
              return fromJS(['images', 'videos', 'files']);
            }

            return null;
          })
          .toJS();
      }

      return state.updateIn(['modifiedData', 'allowedTypes'], currentList => {
        let list = currentList || fromJS([]);

        if (list.includes(action.name)) {
          list = list.filter(v => v !== action.name);

          if (list.size === 0) {
            return null;
          }

          return list;
        }

        return list.push(action.name);
      });
    }
    case RESET_PROPS:
      return initialState;
    case RESET_PROPS_AND_SET_FORM_FOR_ADDING_AN_EXISTING_COMPO: {
      // This is run when the user doesn't want to create a new component
      return fromJS(initialState)
        .update('modifiedData', () => fromJS({ type: 'component', repeatable: true }))
        .toJS();
    }
    case RESET_PROPS_AND_SAVE_CURRENT_DATA: {
      // This is run when the user has created a new component
      const componentToCreate = state.getIn(['modifiedData', 'componentToCreate']);
      const modifiedData = fromJS({
        name: componentToCreate.get('name'),
        type: 'component',
        repeatable: false,
        component: createComponentUid(
          componentToCreate.get('name'),
          componentToCreate.get('category')
        ),
      });

      return fromJS(initialState)
        .update('componentToCreate', () => componentToCreate)
        .update('modifiedData', () => modifiedData)
        .update('isCreatingComponentWhileAddingAField', () =>
          state.getIn(['modifiedData', 'createComponent'])
        )
        .toJS();
    }
    case RESET_PROPS_AND_SET_THE_FORM_FOR_ADDING_A_COMPO_TO_A_DZ: {
      const createdDZ = state.get('modifiedData');
      const dataToSet = createdDZ
        .set('createComponent', true)
        .set('componentToCreate', fromJS({ type: 'component' }));

      return fromJS(initialState)
        .update('modifiedData', () => dataToSet)
        .toJS();
    }
    case SET_DATA_TO_EDIT: {
      return state
        .updateIn(['modifiedData'], () => fromJS(action.data))
        .updateIn(['initialData'], () => fromJS(action.data))
        .toJS();
    }
    case SET_ATTRIBUTE_DATA_SCHEMA: {
      const {
        attributeType,
        isEditing,
        modifiedDataToSetForEditing,
        nameToSetForRelation,
        targetUid,
        step,
      } = action;

      if (isEditing) {
        return state
          .update('modifiedData', () => fromJS(modifiedDataToSetForEditing))
          .update('initialData', () => fromJS(modifiedDataToSetForEditing))
          .toJS();
      }

      let dataToSet;

      if (attributeType === 'component') {
        if (step === '1') {
          dataToSet = {
            type: 'component',
            createComponent: true,
            componentToCreate: { type: 'component' },
          };
        } else {
          dataToSet = {
            type: 'component',
            repeatable: true,
          };
        }
      } else if (attributeType === 'dynamiczone') {
        dataToSet = {
          type: 'dynamiczone',
          components: [],
        };
      } else if (attributeType === 'text') {
        dataToSet = { type: 'string' };
      } else if (attributeType === 'number' || attributeType === 'date') {
        dataToSet = {};
      } else if (attributeType === 'media') {
        dataToSet = {
          allowedTypes: ['images', 'files', 'videos'],
          type: 'media',
          multiple: true,
        };
      } else if (attributeType === 'enumeration') {
        dataToSet = { type: 'enumeration', enum: [] };
      } else if (attributeType === 'relation') {
        dataToSet = {
          name: snakeCase(nameToSetForRelation),
          nature: 'oneWay',
          targetAttribute: '-',
          target: targetUid,
          unique: false,
          dominant: null,
          columnName: null,
          targetColumnName: null,
        };
      } else {
        dataToSet = { type: attributeType, default: null };
      }

      return state.update('modifiedData', () => fromJS(dataToSet)).toJS();
    }
    case SET_DYNAMIC_ZONE_DATA_SCHEMA: {
      return state
        .update('modifiedData', () => fromJS(action.attributeToEdit))
        .update('initialData', () => fromJS(action.attributeToEdit))
        .toJS();
    }

    case SET_ERRORS:
      return state.update('formErrors', () => fromJS(action.errors)).toJS();
    default:
      return state.toJS();
  }
};

export default formModalReducer;
export { initialState };
