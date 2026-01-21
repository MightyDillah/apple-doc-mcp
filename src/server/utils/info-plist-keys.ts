/**
 * Regex pattern for common Apple Info.plist key prefixes
 * Matches prefixes like NS, UI, CF, LS, WK, IN, etc. followed by an uppercase letter
 *
 * Common prefixes:
 * - NS: Foundation/AppKit (NextStep)
 * - UI: UIKit
 * - CF: Core Foundation
 * - LS: Launch Services
 * - WK: WebKit
 * - IN: Intents
 * - MK: MapKit
 * - CK: CloudKit
 * - And many more...
 */
export const INFO_PLIST_KEY_PATTERN =
	/^(NS|UI|CF|LS|WK|IN|MK|CK|CN|HK|PK|SK|GK|MT|AV|CA|CI|CL|CT|EK|FM|GC|GL|IT|MA|MC|ML|MP|NK|NW|OS|PH|PS|QC|RP|SC|SF|SL|SM|SP|SS|ST|TK|TV|UN|VS|WC|WT)[A-Z]/;

/**
 * Check if a string looks like an Info.plist key
 * @param key - The string to check
 * @returns true if it matches the Info.plist key pattern
 */
export const looksLikeInfoPlistKey = (key: string): boolean =>
	INFO_PLIST_KEY_PATTERN.test(key);

/**
 * Resolve a potential Info.plist key to its BundleResources documentation path
 * @param key - The potential Info.plist key
 * @returns The documentation path if it's an Info.plist key, undefined otherwise
 */
export const resolveBundleResourcesPath = (key: string): string | undefined => {
	if (looksLikeInfoPlistKey(key)) {
		return `documentation/bundleresources/information_property_list/${key.toLowerCase()}`;
	}

	return undefined;
};
