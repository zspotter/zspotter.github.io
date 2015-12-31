/**
 * High level overview:
 * Each image is just a very large number (up to 1234 decimal digits). A full
 * period linear congruential generator outputs the underlying numbers for every
 * possible image. Each number is converted to a string with a preset radix.
 * Each character in the string now represents the color value for a pixel.
 * Draw each pixel!
 */

var ExhaustiveRenderer = function(radix, size, canvas) {
  this.context = canvas.getContext('2d');
  this.width = size;
  this.height = size;
  this.cellwidth = Math.floor(canvas.width / size);
  this.radix = radix;
  this.fill = [];
  for (var r = 0; r < radix; r++) {
    this.fill[r] = 'hsl(0,0%,' + Math.floor(100 * r / (radix - 1)) + '%)';
  }
};

ExhaustiveRenderer.prototype.render = function(count) {
  count = count.toString(this.radix);
  var pixel, lightness;

  var limit = Math.min(count.length, this.height * this.width);
  for (var index = 0; index < limit; index++) {
    lightness = parseInt(count.charAt(index), this.radix);

    this.context.fillStyle = this.fill[lightness];
    this.context.fillRect(
      this.cellwidth * (index % this.width), 
      this.cellwidth * Math.floor(index / this.height),
      this.cellwidth, this.cellwidth);
  }
};

/**
 * A full cycle LCG
 * The plus value must be prime
 * The (times value - 1):
 *  must be divisible by all prime factors of `range`
 *  must be a multiple of 4 if `range` is a multiple of 4
 */
function counter(times, plus, range) {
  return function(prev) {
    return prev.times(times).plus(plus).mod(range);
  };
}

document.addEventListener('DOMContentLoaded', function() {
  var size = 32,
      depth = 4, // bits per pixel
      radix = Math.pow(2, depth),
      numImages = new BigNumber(radix).pow(size * size).plus(1),
      timeout = 50,
      nextCount = counter(69069, 12343, numImages);

  var renderer = new ExhaustiveRenderer(radix, size, document.getElementById('clock')),
      startNum = new BigNumber(numImages.times(Math.random().toString())), // Random start each load
      count = startNum;

  function render() {
    count = nextCount(count);
    renderer.render(count);

    // Unlikely to hit this end case unless the universe rolled over MANY times...
    // but for completeness, it is included!
    if (count.equals(startNum)) return;

    setTimeout(render, timeout);
  };
  render();
});