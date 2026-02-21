import { useEffect, useRef } from 'react';
import * as d3 from 'd3-force';
import { database } from '../lib/firebase';
import { ref, onChildAdded, DataSnapshot } from 'firebase/database';

interface Particle extends d3.SimulationNodeDatum {
    id: string;
    optionId: string;
    color: string;
    r: number;
}

interface ParticleCanvasProps {
    questionId: string;
    options: { id: string; text: string }[];
    colors: string[];
}

export default function ParticleCanvas({ questionId, options, colors }: ParticleCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        let width = window.innerWidth;
        let height = window.innerHeight;

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width * window.devicePixelRatio;
            canvas.height = height * window.devicePixelRatio;
            ctx?.scale(window.devicePixelRatio, window.devicePixelRatio);
        };
        resize();
        window.addEventListener('resize', resize);

        const nodes: Particle[] = [];

        // Calculates cluster centers based on the DOM element's position
        const getClusterCenter = (optionId: string) => {
            const el = document.getElementById(`option-card-${optionId}`);
            if (el) {
                const rect = el.getBoundingClientRect();
                return {
                    // Center X
                    x: rect.left + rect.width / 2,
                    // Center Y right in the middle
                    y: rect.top + rect.height / 2 - 20,
                };
            }
            // Fallback
            return { x: width / 2, y: height / 2 };
        };

        const simulation = d3.forceSimulation<Particle>(nodes)
            .alphaDecay(0.005) // Let it gently move for a long time
            .velocityDecay(0.18) // higher friction so bubbles don't bounce out of cards
            // Optimized collision radius multiplier so a 50-item cluster fits perfectly in the card space
            .force('collide', d3.forceCollide<Particle>().radius(d => d.r * 1.8 + 2).iterations(4))
            .force('x', d3.forceX<Particle>().x(d => getClusterCenter(d.optionId).x).strength(0.2))
            .force('y', d3.forceY<Particle>().y(d => getClusterCenter(d.optionId).y).strength(0.2));

        const render = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, width, height);

            // Dynamically update forces continuously in case the window resizes or layout shifts
            simulation.force('x', d3.forceX<Particle>().x(d => getClusterCenter(d.optionId).x).strength(0.1));
            simulation.force('y', d3.forceY<Particle>().y(d => getClusterCenter(d.optionId).y).strength(0.1));

            for (const node of nodes) {
                if (node.x === undefined || node.y === undefined) continue;

                ctx.beginPath();
                ctx.arc(node.x, node.y, node.r, 0, 2 * Math.PI);
                ctx.fillStyle = node.color;

                ctx.shadowColor = node.color;
                ctx.shadowBlur = 15;
                ctx.fill();
            }
        };

        simulation.on('tick', render);

        const streamRef = ref(database, `stream/${questionId}`);
        const unsubscribe = onChildAdded(streamRef, (snapshot: DataSnapshot) => {
            const data = snapshot.val();
            if (!data) return;

            const idx = options.findIndex(o => o.id === data.optionId);
            const color = colors[idx % colors.length] || '#ffffff';

            // Spawn randomly off-screen
            const edge = Math.floor(Math.random() * 4);
            let startX = 0, startY = 0;
            if (edge === 0) { startX = Math.random() * width; startY = -100; }
            else if (edge === 1) { startX = width + 100; startY = Math.random() * height; }
            else if (edge === 2) { startX = Math.random() * width; startY = height + 100; }
            else { startX = -100; startY = Math.random() * height; }

            const newNode: Particle = {
                id: snapshot.key as string,
                optionId: data.optionId,
                color,
                x: startX,
                y: startY,
                vx: (Math.random() - 0.5) * 50,
                vy: (Math.random() - 0.5) * 50,
                r: Math.random() * 4 + 8 // 8-12px size
            };

            nodes.push(newNode);
            simulation.nodes(nodes);
            simulation.alpha(0.8).restart();
        });

        return () => {
            window.removeEventListener('resize', resize);
            simulation.stop();
            unsubscribe();
        };
    }, [questionId, options, colors]);

    return (
        <canvas
            ref={canvasRef}
            // Use z-50 to ensure particles float ON TOP of the cards (z-20)
            className="fixed inset-0 pointer-events-none z-50 w-full h-full drop-shadow-2xl"
        />
    );
}
