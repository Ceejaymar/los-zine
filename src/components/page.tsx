import { useCursor, useHelper, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useAtom } from "jotai";
import { easing } from "maath";
import { useMemo, useRef, useState } from "react";
import {
  Bone,
  BoxGeometry,
  Color,
  Float32BufferAttribute,
  type Group,
  MeshStandardMaterial,
  Skeleton,
  SkeletonHelper,
  SkinnedMesh,
  SRGBColorSpace,
  Uint16BufferAttribute,
  Vector3,
  VideoTexture,
} from "three";
import { degToRad, MathUtils } from "three/src/math/MathUtils.js";
import { pageAtom, pages } from "./ui";

type PageProps = {
  number: number;
  pageData: {
    front: string;
    back: string;
  };
  page: number;
  opened: boolean;
  bookClosed: boolean;
};

const easingFactor = 0.5;
const easingFactorFold = 0.3;
const insideCurveStrength = 0.17;
const outsideCurveStrength = 0.03;
const turningCurveStrength = 0.09;

const PAGE_WIDTH = 1.28;
const PAGE_HEIGHT = 1.71;
const PAGE_DEPTH = 0.003;
const PAGE_SEGMENTS = 30;
const SEGMENT_WIDTH = PAGE_WIDTH / PAGE_SEGMENTS;

const pageGeometry = new BoxGeometry(
  PAGE_WIDTH,
  PAGE_HEIGHT,
  PAGE_DEPTH,
  PAGE_SEGMENTS,
  2,
);

const emissiveColor = new Color("yellow");

pageGeometry.translate(PAGE_WIDTH / 2, 0, 0);

const position = pageGeometry.attributes.position;
const vertex = new Vector3();
const skinIndexes = [];
const skinWeights = [];

for (let i = 0; i < position.count; i++) {
  vertex.fromBufferAttribute(position, i);
  const x = vertex.x;

  const skinIndex = Math.max(0, Math.floor(x / SEGMENT_WIDTH));
  const skinWeight = (x % SEGMENT_WIDTH) / SEGMENT_WIDTH;

  skinIndexes.push(skinIndex, skinIndex + 1, 0, 0);
  skinWeights.push(1 - skinWeight, skinWeight, 0, 0);
}

pageGeometry.setAttribute(
  "skinIndex",
  new Uint16BufferAttribute(skinIndexes, 4),
);

pageGeometry.setAttribute(
  "skinWeight",
  new Float32BufferAttribute(skinWeights, 4),
);

const pageMaterials = [
  new MeshStandardMaterial({ color: "red" }),
  new MeshStandardMaterial({ color: "#111" }),
  new MeshStandardMaterial({ color: "purple" }),
  new MeshStandardMaterial({ color: "#111" }),
];

// Helper variables for handling MP4s dynamically
const BLANK =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const isVideo = (str: string) => str.endsWith(".mp4");
const getTexturePath = (str: string) =>
  isVideo(str) ? `/textures/${str}` : `/textures/${str}.jpg`;

pages.forEach((page) => {
  if (!isVideo(page.front)) useTexture.preload([getTexturePath(page.front)]);
  if (!isVideo(page.back)) useTexture.preload([getTexturePath(page.back)]);
  useTexture.preload([`/textures/book-cover-roughness.png`]);
});

export default function Page({
  number,
  pageData,
  page,
  opened,
  bookClosed,
  ...props
}: PageProps & React.ComponentProps<"group">) {
  const frontIsVid = isVideo(pageData.front);
  const backIsVid = isVideo(pageData.back);

  const [pictureImg, picture2Img, pictureRoughness] = useTexture([
    frontIsVid ? BLANK : getTexturePath(pageData.front),
    backIsVid ? BLANK : getTexturePath(pageData.back),
    ...(number === 0 || number === pages.length - 1
      ? [`/textures/book-cover-roughness.png`]
      : []),
  ]);

  const frontVideoTex = useMemo(() => {
    if (!frontIsVid) return null;
    const vid = document.createElement("video");
    vid.src = getTexturePath(pageData.front);
    vid.crossOrigin = "Anonymous";
    vid.playsInline = true;
    vid.loop = true;
    vid.muted = true;
    vid.play();
    const tex = new VideoTexture(vid);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, [pageData.front, frontIsVid]);

  const backVideoTex = useMemo(() => {
    if (!backIsVid) return null;
    const vid = document.createElement("video");
    vid.src = getTexturePath(pageData.back);
    vid.crossOrigin = "Anonymous";
    vid.playsInline = true;
    vid.loop = true;
    vid.muted = true;
    vid.play();
    const tex = new VideoTexture(vid);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, [pageData.back, backIsVid]);

  const picture = frontIsVid && frontVideoTex ? frontVideoTex : pictureImg;
  const picture2 = backIsVid && backVideoTex ? backVideoTex : picture2Img;

  if (picture) picture.colorSpace = SRGBColorSpace;
  if (picture2) picture2.colorSpace = SRGBColorSpace;

  const group = useRef<Group>(null);
  const turnedAt = useRef(0);
  const lastOpened = useRef(opened);

  const skinnedMeshRef = useRef<SkinnedMesh>(null);

  const manualSkinnedMesh = useMemo(() => {
    const bones = [];
    for (let i = 0; i <= PAGE_SEGMENTS; i++) {
      const bone = new Bone();
      bones.push(bone);

      if (i === 0) {
        bone.position.x = 0;
      } else {
        bone.position.x = SEGMENT_WIDTH;
      }

      if (i > 0) {
        bones[i - 1].add(bone);
      }
    }

    const skeleton = new Skeleton(bones);

    const materials = [
      ...pageMaterials,
      new MeshStandardMaterial({
        color: "white",
        map: picture,
        ...(number === 0
          ? { roughnessMap: pictureRoughness }
          : { roughness: 0.1 }),
        emissive: emissiveColor,
        emissiveIntensity: 0,
      }),
      new MeshStandardMaterial({
        color: "white",
        map: picture2,
        ...(number === pages.length - 1
          ? { roughnessMap: pictureRoughness }
          : { roughness: 0.1 }),
        emissive: emissiveColor,
        emissiveIntensity: 0,
      }),
    ];
    const mesh = new SkinnedMesh(pageGeometry, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.add(skeleton.bones[0]);
    mesh.bind(skeleton);

    return mesh;
  }, [picture, picture2, pictureRoughness, number]);

  // useHelper(skinnedMeshRef, SkeletonHelper, "red");

  useFrame((_, delta) => {
    if (!skinnedMeshRef.current) return;

    const emissiveIntensity = highlighted ? 0.22 : 0;
    skinnedMeshRef.current.material[4].emissiveIntensity =
      skinnedMeshRef.current.material[5].emissiveIntensity = MathUtils.lerp(
        skinnedMeshRef.current.material[4].emissiveIntensity,
        emissiveIntensity,
        0.1,
      );

    if (lastOpened.current !== opened) {
      turnedAt.current = Date.now();
      lastOpened.current = opened;
    }

    let turningTime = Math.min(400, Date.now() - turnedAt.current) / 400;
    turningTime = Math.sin(turningTime * Math.PI);

    let targetRotation = opened ? -Math.PI / 2 : Math.PI / 2;
    if (!bookClosed) {
      targetRotation += degToRad(number * 0.8);
    }

    const bones = skinnedMeshRef.current.skeleton.bones;

    for (let i = 0; i < bones.length; i++) {
      const target = i === 0 ? group.current : bones[i];
      if (!target) continue;

      const insideCurveIntensity = i < 8 ? Math.sin(i * 0.2 + 0.25) : 0;
      const outsideCurveIntensity = i >= 8 ? Math.cos(i * 0.3 - 0.09) : 0;
      const turningIntensity =
        Math.sin(i * Math.PI * (1 / bones.length)) * turningTime;

      let rotationAngle =
        insideCurveStrength * insideCurveIntensity * targetRotation -
        outsideCurveStrength * outsideCurveIntensity * targetRotation +
        turningCurveStrength * turningIntensity * targetRotation;

      let foldRotationAngle = degToRad(Math.sign(targetRotation) * 2);

      if (bookClosed) {
        if (i === 0) {
          rotationAngle = targetRotation;
          foldRotationAngle = 0;
        } else {
          rotationAngle = 0;
          foldRotationAngle = 0;
        }
      }

      easing.dampAngle(
        target.rotation,
        "y",
        rotationAngle,
        easingFactor,
        delta,
      );

      const foldIntensity =
        i > 8
          ? Math.sin(i * Math.PI * (1 / bones.length) - 0.5) * turningTime
          : 0;

      easing.dampAngle(
        target.rotation,
        "x",
        foldRotationAngle * foldIntensity,
        easingFactorFold,
        delta,
      );
    }
  });

  const [_, setPage] = useAtom(pageAtom);
  const [highlighted, setHighlighted] = useState(false);
  useCursor(highlighted);

  return (
    <group
      {...props}
      ref={group}
      onPointerEnter={(e) => {
        e.stopPropagation();
        setHighlighted(true);
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setHighlighted(false);
      }}
      onClick={(e) => {
        e.stopPropagation();
        setPage(opened ? number : number + 1);
        setHighlighted(false);
      }}
    >
      <primitive
        object={manualSkinnedMesh}
        ref={skinnedMeshRef}
        position-z={-number * PAGE_DEPTH + page * PAGE_DEPTH}
      />
    </group>
  );
}
