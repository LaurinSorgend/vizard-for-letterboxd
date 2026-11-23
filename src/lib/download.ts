/** Triggers a browser file download and defers object-URL revocation so WebKit finishes reading it. */
export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.append(link);
	try {
		link.click();
	} finally {
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
}
