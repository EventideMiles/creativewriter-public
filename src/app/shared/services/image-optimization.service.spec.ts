import { convertToWebP } from './image-optimization.service';

describe('convertToWebP', () => {
  it('should convert .png to .webp', () => {
    expect(convertToWebP('image.png')).toBe('image.webp');
  });

  it('should convert .PNG (uppercase) to .webp', () => {
    expect(convertToWebP('image.PNG')).toBe('image.webp');
  });

  it('should convert .Png (mixed case) to .webp', () => {
    expect(convertToWebP('image.Png')).toBe('image.webp');
  });

  it('should only replace .png at end of string', () => {
    expect(convertToWebP('png-image.png')).toBe('png-image.webp');
  });

  it('should not modify non-png files', () => {
    expect(convertToWebP('image.jpg')).toBe('image.jpg');
    expect(convertToWebP('image.webp')).toBe('image.webp');
    expect(convertToWebP('image.jpeg')).toBe('image.jpeg');
  });

  it('should handle filenames with multiple dots', () => {
    expect(convertToWebP('my.image.file.png')).toBe('my.image.file.webp');
  });

  it('should handle paths with directories', () => {
    expect(convertToWebP('assets/backgrounds/image.png')).toBe('assets/backgrounds/image.webp');
  });
});
