import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class DropToCdnApi implements ICredentialType {
	name = 'dropToCdnApi';

	displayName = 'Drop to CDN API';

	icon: Icon = { light: 'file:../nodes/DropToCdn/droptocdn.svg', dark: 'file:../nodes/DropToCdn/droptocdn.svg' };

	documentationUrl = 'https://github.com/Nexus-JPF/droptocdn/blob/main/docs/integrations/n8n.md';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'Create a key in Drop to CDN → Settings → API keys. Keys start with dtc_.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.droptocdn.com/v1',
			url: '/profile',
			method: 'GET',
		},
	};
}
