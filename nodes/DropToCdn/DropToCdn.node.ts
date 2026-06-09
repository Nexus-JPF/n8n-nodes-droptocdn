import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

const BASE_URL = 'https://api.droptocdn.com/v1';

type MultipartPart = {
	name: string;
	value: string | Buffer;
	filename?: string;
	contentType?: string;
};

function buildMultipartBody(parts: MultipartPart[]): { body: Buffer; contentType: string } {
	const boundary = `----n8nFormBoundary${Date.now()}${Math.random().toString(36).slice(2)}`;
	const chunks: Buffer[] = [];

	for (const part of parts) {
		let header = `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"`;
		if (part.filename) {
			const safeName = part.filename.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
			header += `; filename="${safeName}"`;
		}
		header += '\r\n';
		if (part.contentType) {
			header += `Content-Type: ${part.contentType}\r\n`;
		}
		header += '\r\n';
		chunks.push(Buffer.from(header, 'utf8'));
		chunks.push(typeof part.value === 'string' ? Buffer.from(part.value, 'utf8') : part.value);
		chunks.push(Buffer.from('\r\n', 'utf8'));
	}

	chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));

	return {
		body: Buffer.concat(chunks),
		contentType: `multipart/form-data; boundary=${boundary}`,
	};
}

export class DropToCdn implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Drop to CDN',
		name: 'dropToCdn',
		icon: { light: 'file:droptocdn.svg', dark: 'file:droptocdn.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Upload files to Drop to CDN and get instant public CDN URLs',
		defaults: {
			name: 'Drop to CDN',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'dropToCdnApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'File',
						value: 'file',
					},
				],
				default: 'file',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['file'],
					},
				},
				options: [
					{
						name: 'Delete',
						value: 'delete',
						description: 'Permanently delete a file by ID',
						action: 'Delete a file',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get CDN URL and metadata for a file by ID',
						action: 'Get file information',
					},
					{
						name: 'Upload',
						value: 'upload',
						description: 'Upload a file and get a public CDN URL',
						action: 'Upload a file',
					},
				],
				default: 'upload',
			},
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['upload'],
					},
				},
				description: 'Name of the binary property containing the file to upload',
			},
			{
				displayName: 'Retention (Days)',
				name: 'retentionDays',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: '',
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['upload'],
					},
				},
				description: 'How long to keep the file in days. Uses your plan default if omitted.',
			},
			{
				displayName: 'Never Expire',
				name: 'neverExpire',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['upload'],
					},
				},
				description: 'Whether to skip expiration (paid plans only)',
			},
			{
				displayName: 'File ID',
				name: 'fileId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['get', 'delete'],
					},
				},
				description: 'The file ID from Upload or your Drop to CDN dashboard',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				if (resource === 'file') {
					if (operation === 'upload') {
						const binaryPropertyName = this.getNodeParameter(
							'binaryPropertyName',
							itemIndex,
						) as string;
						const retentionDays = this.getNodeParameter('retentionDays', itemIndex) as number;
						const neverExpire = this.getNodeParameter('neverExpire', itemIndex) as boolean;

						const binaryData = this.helpers.assertBinaryData(itemIndex, binaryPropertyName);
						const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);

						const parts: MultipartPart[] = [
							{
								name: 'file',
								value: buffer,
								filename: binaryData.fileName ?? 'upload',
								contentType: binaryData.mimeType ?? 'application/octet-stream',
							},
						];

						if (retentionDays) {
							parts.push({ name: 'retention_days', value: String(retentionDays) });
						}
						if (neverExpire) {
							parts.push({ name: 'never_expire', value: 'true' });
						}

						const { body, contentType } = buildMultipartBody(parts);

						const response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'dropToCdnApi',
							{
								method: 'POST',
								url: `${BASE_URL}/files`,
								body,
								headers: {
									'Content-Type': contentType,
									'Content-Length': body.length,
								},
							},
						);

						returnData.push({ json: response as IDataObject, pairedItem: itemIndex });
					} else if (operation === 'get') {
						const fileId = this.getNodeParameter('fileId', itemIndex) as string;
						if (!fileId?.trim()) {
							throw new NodeOperationError(this.getNode(), 'File ID is required', {
								itemIndex,
							});
						}

						const response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'dropToCdnApi',
							{
								method: 'GET',
								url: `${BASE_URL}/files/${encodeURIComponent(fileId.trim())}`,
							},
						);

						returnData.push({ json: response as IDataObject, pairedItem: itemIndex });
					} else if (operation === 'delete') {
						const fileId = this.getNodeParameter('fileId', itemIndex) as string;
						if (!fileId?.trim()) {
							throw new NodeOperationError(this.getNode(), 'File ID is required', {
								itemIndex,
							});
						}

						const trimmedId = fileId.trim();

						await this.helpers.httpRequestWithAuthentication.call(this, 'dropToCdnApi', {
							method: 'DELETE',
							url: `${BASE_URL}/files/${encodeURIComponent(trimmedId)}`,
						});

						returnData.push({
							json: { id: trimmedId, deleted: true },
							pairedItem: itemIndex,
						});
					} else {
						throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, {
							itemIndex,
						});
					}
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`, {
						itemIndex,
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					const message = error instanceof Error ? error.message : 'Unknown error';
					returnData.push({
						json: { error: message },
						pairedItem: itemIndex,
					});
					continue;
				}

				if (error instanceof NodeOperationError) {
					throw error;
				}

				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
			}
		}

		return [returnData];
	}
}
