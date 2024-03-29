import { Box, Button, FieldGroup, ButtonGroup } from '@rocket.chat/fuselage';
import { useMutableCallback } from '@rocket.chat/fuselage-hooks';
import { useToastMessageDispatch, useRoute, useMethod, useTranslation } from '@rocket.chat/ui-contexts';
import React, { useCallback, useState } from 'react';

import Page from '../../../components/Page';
import { useForm } from '../../../hooks/useForm';
import { CustomFieldsAdditionalFormContainer } from '../additionalForms';
import NewCustomFieldsForm from './NewCustomFieldsForm';

const initialValues = {
	field: '',
	label: '',
	scope: 'visitor',
	visibility: true,
	regexp: '',
	searchable: true,
};

const NewCustomFieldsPage = ({ reload }) => {
	const t = useTranslation();
	const dispatchToastMessage = useToastMessageDispatch();

	const [additionalValues, setAdditionalValues] = useState({});

	const router = useRoute('omnichannel-customfields');

	const handleReturn = useCallback(() => {
		router.push({});
	}, [router]);

	const { values, handlers, hasUnsavedChanges } = useForm(initialValues);

	const save = useMethod('livechat:saveCustomField');

	const { hasError, data: additionalData, hasUnsavedChanges: additionalFormChanged } = additionalValues;

	const { label, field } = values;

	const canSave = !hasError && label && field && (additionalFormChanged || hasUnsavedChanges);

	const handleSave = useMutableCallback(async () => {
		try {
			await save(undefined, {
				...values,
				visibility: values.visibility ? 'visible' : 'hidden',
				...additionalData,
			});

			dispatchToastMessage({ type: 'success', message: t('Saved') });
			reload();
			router.push({});
		} catch (error) {
			dispatchToastMessage({ type: 'error', message: error });
		}
	});

	const handleAdditionalForm = useMutableCallback((val) => {
		setAdditionalValues({ ...additionalValues, ...val });
	});

	return (
		<Page>
			<Page.Header title={t('New_Custom_Field')}>
				<ButtonGroup>
					<Button icon='back' onClick={handleReturn}>
						{t('Back')}
					</Button>
					<Button data-qa-id='NewCustomFieldsPageButtonSave' primary onClick={handleSave} disabled={!canSave}>
						{t('Save')}
					</Button>
				</ButtonGroup>
			</Page.Header>
			<Page.ScrollableContentWithShadow>
				<Box maxWidth='x600' w='full' alignSelf='center'>
					<FieldGroup>
						<NewCustomFieldsForm values={values} handlers={handlers} />
						<CustomFieldsAdditionalFormContainer onChange={handleAdditionalForm} state={values} />
					</FieldGroup>
				</Box>
			</Page.ScrollableContentWithShadow>
		</Page>
	);
};

export default NewCustomFieldsPage;
