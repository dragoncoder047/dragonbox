// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

// interface shared by number[], Float32Array, and other typed arrays in JavaScript.
interface NumberArray {
	length: number;
	[index: number]: number;
}

// A basic FFT operation scales the overall magnitude of elements by the
// square root of the length of the array, √N. Performing a forward FFT and
// then an inverse FFT results in the original array, but multiplied by N.
// This helper function can be used to compensate for that. 
export function scaleElementsByFactor(array: NumberArray, factor: number): void {
	for (let i = 0; i < array.length; i++) {
		array[i] *= factor;
	}
}

function isPowerOf2(n: number): boolean {
	return !!n && !(n & (n - 1));
}

function countBits(n: number): number {
	if (!isPowerOf2(n)) throw new Error("FFT array length must be a power of 2.");
	return Math.round(Math.log(n) / Math.log(2));
}

// Rearranges the elements of the array, swapping the element at an index
// with an element at an index that is the bitwise reverse of the first
// index in base 2. Useful for computing the FFT.
function reverseIndexBits(array: NumberArray, fullArrayLength: number): void {
	const bitCount = countBits(fullArrayLength);
	if (bitCount > 16) throw new Error("FFT array length must not be greater than 2^16.");
	const finalShift = 16 - bitCount;
	for (let i = 0; i < fullArrayLength; i++) {
		// Dear Javascript: Please support bit order reversal intrinsics. Thanks! :D
		let j: number;
		j = ((i & 0xaaaa) >> 1) | ((i & 0x5555) << 1);
		j = ((j & 0xcccc) >> 2) | ((j & 0x3333) << 2);
		j = ((j & 0xf0f0) >> 4) | ((j & 0x0f0f) << 4);
			j = ((j           >> 8) | ((j &   0xff) << 8)) >> finalShift;
		if (j > i) {
			let temp = array[i];
			array[i] = array[j];
			array[j] = temp;
		}
	}
}

// Provided for educational purposes. Easier to read than
// fastFourierTransform(), but computes the same result.
// Takes two parallel arrays representing the real and imaginary elements,
// respectively, and returns an array containing two new arrays, which
// contain the complex result of the transform.
export function discreteFourierTransform(realArray: NumberArray, imagArray: NumberArray): number[][] {
	const fullArrayLength = realArray.length;
	if (fullArrayLength != imagArray.length) throw new Error("FFT arrays must be the same length.");
	const realOut: number[] = [];
	const imagOut: number[] = [];
	for (let i = 0; i < fullArrayLength; i++) {
		realOut[i] = 0.0;
		imagOut[i] = 0.0;
		for (let j = 0; j < fullArrayLength; j++) {
			const radians = -6.2831853 * j * i / fullArrayLength;
			const c = Math.cos(radians);
			const s = Math.sin(radians);
			realOut[i] += realArray[j] * c - imagArray[j] * s;
			imagOut[i] += realArray[j] * s + imagArray[j] * c;
		}
	}
	return [realOut, imagOut];
}

// Performs a Fourier transform in O(N log(N)) operations. Overwrites the
// input real and imaginary arrays. Can be used for both forward and inverse
// transforms: swap the order of the arguments for the inverse.
export function fastFourierTransform(realArray: NumberArray, imagArray: NumberArray): void {
	const fullArrayLength = realArray.length;
	if (!isPowerOf2(fullArrayLength)) throw new Error("FFT array length must be a power of 2.");
	if (fullArrayLength < 4) throw new Error("FFT array length must be at least 4.");
	if (fullArrayLength != imagArray.length) throw new Error("FFT arrays must be the same length.");
		
	reverseIndexBits(realArray, fullArrayLength);
	reverseIndexBits(imagArray, fullArrayLength);
		
	// First two passes, with strides of 2 and 4, can be combined and optimized.
	for (let startIndex = 0; startIndex < fullArrayLength; startIndex += 4) {
		const startIndex1 = startIndex + 1;
		const startIndex2 = startIndex + 2;
		const startIndex3 = startIndex + 3;
			const real0 = realArray[startIndex ];
		const real1 = realArray[startIndex1];
		const real2 = realArray[startIndex2];
		const real3 = realArray[startIndex3];
			const imag0 = imagArray[startIndex ];
		const imag1 = imagArray[startIndex1];
		const imag2 = imagArray[startIndex2];
		const imag3 = imagArray[startIndex3];
		const realTemp0 = real0 + real1;
		const realTemp1 = real0 - real1;
		const realTemp2 = real2 + real3;
		const realTemp3 = real2 - real3;
		const imagTemp0 = imag0 + imag1;
		const imagTemp1 = imag0 - imag1;
		const imagTemp2 = imag2 + imag3;
		const imagTemp3 = imag2 - imag3;
			realArray[startIndex ] = realTemp0 + realTemp2;
		realArray[startIndex1] = realTemp1 + imagTemp3;
		realArray[startIndex2] = realTemp0 - realTemp2;
		realArray[startIndex3] = realTemp1 - imagTemp3;
			imagArray[startIndex ] = imagTemp0 + imagTemp2;
		imagArray[startIndex1] = imagTemp1 - realTemp3;
		imagArray[startIndex2] = imagTemp0 - imagTemp2;
		imagArray[startIndex3] = imagTemp1 + realTemp3;
	}
		
	for (let stride = 8; stride <= fullArrayLength; stride += stride) {
		const halfLength = stride >>> 1;
		const radiansIncrement = Math.PI * 2.0 / stride;
		const cosIncrement = Math.cos(radiansIncrement);
		const sinIncrement = Math.sin(radiansIncrement);
		const oscillatorMultiplier = 2.0 * cosIncrement;
		for (let startIndex = 0; startIndex < fullArrayLength; startIndex += stride) {
			let c = 1.0;
			let s = 0.0;
			let cPrev = cosIncrement;
			let sPrev = sinIncrement;
			const secondHalf = startIndex + halfLength;
			for (let i = startIndex; i < secondHalf; i++) {
				const j = i + halfLength;
				const real0 = realArray[i];
				const imag0 = imagArray[i];
				const real1 = realArray[j] * c - imagArray[j] * s;
				const imag1 = realArray[j] * s + imagArray[j] * c;
				realArray[i] = real0 + real1;
				imagArray[i] = imag0 + imag1;
				realArray[j] = real0 - real1;
				imagArray[j] = imag0 - imag1;
				const cTemp = oscillatorMultiplier * c - cPrev;
				const sTemp = oscillatorMultiplier * s - sPrev;
				cPrev = c;
				sPrev = s;
				c = cTemp;
				s = sTemp;
			}
		}
	}
}

// Computes the Fourier transform from an array of real-valued time-domain
// samples. The output is specially formatted for space efficieny: elements
// 0 through N/2 represent cosine wave amplitudes in ascending frequency,
// and elements N/2+1 through N-1 represent sine wave amplitudes in
// descending frequency. Overwrites the input array.
export function forwardRealFourierTransform(array: NumberArray): void {
	const fullArrayLength = array.length;
	const totalPasses = countBits(fullArrayLength);
	if (fullArrayLength < 4) throw new Error("FFT array length must be at least 4.");
		
	reverseIndexBits(array, fullArrayLength);
		
	// First and second pass.
	for (let index = 0; index < fullArrayLength; index += 4) {
		const index1 = index + 1;
		const index2 = index + 2;
		const index3 = index + 3;
			const real0 = array[index ];
		const real1 = array[index1];
		const real2 = array[index2];
		const real3 = array[index3];
		// no imaginary elements yet since the input is fully real.
		const tempA = real0 + real1;
		const tempB = real2 + real3;
			array[index ] = tempA + tempB;
		array[index1] = real0 - real1;
		array[index2] = tempA - tempB;
		array[index3] = real2 - real3;
	}
		
	// Third pass.
	const sqrt2over2 = Math.sqrt(2.0) / 2.0;
	for (let index = 0; index < fullArrayLength; index += 8) {
		const index1 = index + 1;
		const index3 = index + 3;
		const index4 = index + 4;
		const index5 = index + 5;
		const index7 = index + 7;
			const real0 = array[index ];
		const real1 = array[index1];
		const imag3 = array[index3];
		const real4 = array[index4];
		const real5 = array[index5];
		const imag7 = array[index7];
		const tempA = (real5 - imag7) * sqrt2over2;
		const tempB = (real5 + imag7) * sqrt2over2;
			array[index ] = real0 + real4;
		array[index1] = real1 + tempA;
		array[index3] = real1 - tempA;
		array[index4] = real0 - real4;
		array[index5] = tempB - imag3;
		array[index7] = tempB + imag3;
	}
		
	// Handle remaining passes.
	for (let pass = 3; pass < totalPasses; pass++) {
		const subStride = 1 << pass;
		const midSubStride = subStride >> 1;
		const stride = subStride << 1;
		const radiansIncrement = Math.PI * 2.0 / stride;
		const cosIncrement = Math.cos(radiansIncrement);
		const sinIncrement = Math.sin(radiansIncrement);
		const oscillatorMultiplier = 2.0 * cosIncrement;
		for (let startIndex = 0; startIndex < fullArrayLength; startIndex += stride) {
			const startIndexA = startIndex;
			const startIndexB = startIndexA + subStride;
			const stopIndex = startIndexB + subStride;
			const realStartA = array[startIndexA];
			const realStartB = array[startIndexB];
			array[startIndexA] = realStartA + realStartB;
			array[startIndexB] = realStartA - realStartB;
			let c = cosIncrement;
			let s = -sinIncrement;
			let cPrev = 1.0;
			let sPrev = 0.0;
			for (let index = 1; index < midSubStride; index++) {
				const indexA0 = startIndexA + index;
				const indexA1 = startIndexB - index;
				const indexB0 = startIndexB + index;
					const indexB1 = stopIndex   - index;
				const real0 = array[indexA0];
				const imag0 = array[indexA1];
				const real1 = array[indexB0];
				const imag1 = array[indexB1];
				const tempA = real1 * c + imag1 * s;
				const tempB = real1 * s - imag1 * c;
				array[indexA0] = real0 + tempA;
				array[indexA1] = real0 - tempA;
					array[indexB0] =-imag0 - tempB;
				array[indexB1] = imag0 - tempB;
				const cTemp = oscillatorMultiplier * c - cPrev;
				const sTemp = oscillatorMultiplier * s - sPrev;
				cPrev = c;
				sPrev = s;
				c = cTemp;
				s = sTemp;
			}
		}
	}
}

// Computes the inverse Fourier transform from a specially formatted array of
// scalar values. Elements 0 through N/2 are expected to be the real values of
// the corresponding complex elements, representing cosine wave amplitudes in
// ascending frequency, and elements N/2+1 through N-1 correspond to the
// imaginary values, representing sine wave amplitudes in descending frequency.
// Generates real-valued time-domain samples. Overwrites the input array.
export function inverseRealFourierTransform(array: NumberArray, fullArrayLength: number): void {
	const totalPasses = countBits(fullArrayLength);
	if (fullArrayLength < 4) throw new Error("FFT array length must be at least 4.");

	// Perform all but the last few passes in reverse.
	for (let pass = totalPasses - 1; pass >= 2; pass--) {
		const subStride = 1 << pass;
		const midSubStride = subStride >> 1;
		const stride = subStride << 1;
		const radiansIncrement = Math.PI * 2.0 / stride;
		const cosIncrement = Math.cos(radiansIncrement);
		const sinIncrement = Math.sin(radiansIncrement);
		const oscillatorMultiplier = 2.0 * cosIncrement;
			
		for (let startIndex = 0; startIndex < fullArrayLength; startIndex += stride) {
			const startIndexA = startIndex;
			const midIndexA = startIndexA + midSubStride;
			const startIndexB = startIndexA + subStride;
			const midIndexB = startIndexB + midSubStride;
			const stopIndex = startIndexB + subStride;
			const realStartA = array[startIndexA];
			const imagStartB = array[startIndexB];
			array[startIndexA] = realStartA + imagStartB;
			array[midIndexA] *= 2;
			array[startIndexB] = realStartA - imagStartB;
			array[midIndexB] *= 2;
			let c = cosIncrement;
			let s = -sinIncrement;
			let cPrev = 1.0;
			let sPrev = 0.0;
			for (let index = 1; index < midSubStride; index++) {
				const indexA0 = startIndexA + index;
				const indexA1 = startIndexB - index;
				const indexB0 = startIndexB + index;
					const indexB1 = stopIndex   - index;
				const real0 = array[indexA0];
				const real1 = array[indexA1];
				const imag0 = array[indexB0];
				const imag1 = array[indexB1];
				const tempA = real0 - real1;
				const tempB = imag0 + imag1;
				array[indexA0] = real0 + real1;
				array[indexA1] = imag1 - imag0;
				array[indexB0] = tempA * c - tempB * s;
				array[indexB1] = tempB * c + tempA * s;
				const cTemp = oscillatorMultiplier * c - cPrev;
				const sTemp = oscillatorMultiplier * s - sPrev;
				cPrev = c;
				sPrev = s;
				c = cTemp;
				s = sTemp;
			}
		}
	}
	/*
	// Commented out this block (and compensated with an extra pass above)
	// because it's slower in my testing so far.
	// Pass with stride 8.
	const sqrt2over2 = Math.sqrt(2.0) / 2.0;
	for (let index = 0; index < fullArrayLength; index += 8) {
		const index1 = index + 1;
		const index2 = index + 2;
		const index3 = index + 3;
		const index4 = index + 4;
		const index5 = index + 5;
		const index6 = index + 6;
		const index7 = index + 7;
		const real0 = array[index ];
		const real1 = array[index1];
		const real2 = array[index2];
		const real3 = array[index3];
		const imag4 = array[index4];
		const imag5 = array[index5];
		const imag6 = array[index6];
		const imag7 = array[index7];
		const tempA = real1 - real3;
		const tempB = imag5 + imag7;
		array[index ] = real0 + imag4;
		array[index1] = real1 + real3;
		array[index2] = real2 * 2;
		array[index3] = imag7 - imag5;
		array[index4] = real0 - imag4;
		array[index5] = (tempA + tempB) * sqrt2over2;
		array[index6] = imag6 * 2;
		array[index7] = (tempB - tempA) * sqrt2over2;
	}
	*/
	// The final passes with strides 4 and 2, combined into one loop.
	for (let index = 0; index < fullArrayLength; index += 4) {
		const index1 = index + 1;
		const index2 = index + 2;
		const index3 = index + 3;
			const real0 = array[index ];
		const real1 = array[index1] * 2;
		const imag2 = array[index2];
		const imag3 = array[index3] * 2;
		const tempA = real0 + imag2;
		const tempB = real0 - imag2;
			array[index ] = tempA + real1;
		array[index1] = tempA - real1;
		array[index2] = tempB + imag3;
		array[index3] = tempB - imag3;
	}
		
	reverseIndexBits(array, fullArrayLength);
}
