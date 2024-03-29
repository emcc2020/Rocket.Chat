import { useSetModal, usePermission } from '@rocket.chat/ui-contexts';
import type { FC, MouseEvent, MouseEventHandler } from 'react';
import React, { memo } from 'react';

import CreateCannedResponse from '../../CannedResponse/modals';
import CannedResponse from './CannedResponse';

const WrapCannedResponse: FC<{
	allowUse: boolean;
	cannedItem: any;
	onClickBack: MouseEventHandler<HTMLOrSVGElement>;
	onClickUse: (e: MouseEvent<HTMLOrSVGElement>, text: string) => void;
	reload: () => void;
}> = ({
	allowUse,
	cannedItem: { _id, departmentName, departmentId, shortcut, tags, scope, text } = {},
	onClickBack,
	onClickUse,
	reload,
}) => {
	const setModal = useSetModal();
	const onClickEdit = (): void => {
		setModal(<CreateCannedResponse data={{ _id, departmentId, shortcut, tags, scope, text }} reloadCannedList={reload} />);
	};

	const hasManagerPermission = usePermission('view-all-canned-responses');
	const hasMonitorPermission = usePermission('save-department-canned-responses');

	const allowEdit = hasManagerPermission || (hasMonitorPermission && scope !== 'global') || scope === 'user';

	return (
		<CannedResponse
			allowEdit={allowEdit}
			allowUse={allowUse}
			data={{
				departmentName,
				shortcut,
				tags,
				scope,
				text,
			}}
			onClickBack={onClickBack}
			onClickEdit={onClickEdit}
			onClickUse={(e): void => {
				onClickUse(e, text);
			}}
		/>
	);
};

export default memo(WrapCannedResponse);
